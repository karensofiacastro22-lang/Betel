const router = require('express').Router();
const path = require('path');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { q, one } = require('../db');
const { can, requiereLogin, wrap, gruposPermitidos, auditar } = require('../auth');

router.use(requiereLogin);

const LOGO = path.join(__dirname, '..', '..', 'public', 'img', 'logo-v.png');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Genera el archivo en PDF o Excel a partir de columnas y filas
async function entregar(res, formato, nombre, titulo, subtitulo, cols, filas) {
  if (formato === 'xlsx') {
    const wb = new ExcelJS.Workbook(); wb.creator = 'BETEL';
    const ws = wb.addWorksheet(titulo.replace(/[*?:\\/\[\]]/g, ' ').slice(0, 30));
    ws.addRow([`Misión Cristiana El Calvario — ${titulo}`]).font = { bold: true, size: 14 };
    ws.addRow([subtitulo]); ws.addRow([]);
    const h = ws.addRow(cols.map(c => c.t));
    h.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8590C' } }; });
    filas.forEach(f => ws.addRow(cols.map(c => f[c.k] ?? '')));
    cols.forEach((c, i) => { ws.getColumn(i + 1).width = c.w || 18; });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}.xlsx"`);
    await wb.xlsx.write(res); return res.end();
  }
  // El documento se crea antes de enviar encabezados: si falla (p. ej. faltan las fuentes en Vercel) el error
  // llega al manejador como un 500 normal en lugar de dejar la descarga a medias o tumbar la función.
  const doc = new PDFDocument({ size: 'A4', margin: 40, layout: cols.length > 6 ? 'landscape' : 'portrait', bufferPages: true });
  doc.on('error', (e) => { console.error('Error generando PDF:', e); res.destroy(e); });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}.pdf"`);
  doc.pipe(res);
  const W = doc.page.width - 80;
  doc.rect(0, 0, doc.page.width, 70).fill('#111111');
  try { doc.image(LOGO, 40, 10, { height: 50 }); } catch (_) {}
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(15).text('Misión Cristiana El Calvario', 100, 16);
  doc.font('Helvetica').fontSize(10).fillColor('#f4a261').text(`BETEL · ${titulo}`, 100, 38);
  doc.fillColor('#333').fontSize(9).text(subtitulo, 40, 82);
  let y = 104;
  const tot = cols.reduce((s, c) => s + (c.w || 18), 0);
  const ancho = cols.map(c => (c.w || 18) / tot * W);
  const cabecera = () => {
    doc.rect(40, y, W, 20).fill('#e8590c'); let x = 40;
    cols.forEach((c, i) => { doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8.5).text(c.t, x + 4, y + 6, { width: ancho[i] - 8, lineBreak: false }); x += ancho[i]; });
    y += 22;
  };
  cabecera();
  filas.forEach((f, n) => {
    if (y > doc.page.height - 60) { doc.addPage(); y = 40; cabecera(); }
    if (n % 2) doc.rect(40, y - 2, W, 18).fill('#fff4ec');
    let x = 40;
    cols.forEach((c, i) => { doc.fillColor('#111').font('Helvetica').fontSize(8.5).text(String(f[c.k] ?? ''), x + 4, y + 2, { width: ancho[i] - 8, lineBreak: false, ellipsis: true }); x += ancho[i]; });
    y += 18;
  });
  if (!filas.length) doc.fillColor('#666').text('Sin registros para los criterios seleccionados.', 40, y + 6);
  const r = doc.bufferedPageRange();
  for (let i = 0; i < r.count; i++) {
    doc.switchToPage(i);
    doc.fillColor('#888').fontSize(8).text(`Generado ${new Date().toLocaleDateString('es-CO')} · Página ${i + 1} de ${r.count} · Información confidencial (Ley 1581 de 2012)`,
      40, doc.page.height - 30, { width: W, align: 'center', lineBreak: false });
  }
  doc.end();
}

// Nombre de archivo seguro (sin tildes ni espacios)
const slug = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);

const fmt = (req) => (req.query.formato === 'pdf' ? 'pdf' : 'xlsx');

// Asistencia por sesión: ?desde=&hasta=&tipo=&grupo_id=&horario_id= (eucaristía/reunión)&sesion_id= (una lista concreta)
router.get('/asistencia', wrap(async (req, res) => {
  if (!can(req.user, 'reportes.ver')) return res.status(403).json({ error: 'No tiene permiso' });
  const { desde, hasta, tipo, grupo_id, horario_id, sesion_id } = req.query;
  const g = await gruposPermitidos(req.user);
  let w = ' WHERE 1=1'; const p = [];
  if (g !== null) { if (!g.length) w += ' AND 1=0'; else { w += " AND s.tipo='grupo' AND s.grupo_id IN (?)"; p.push(g); } }
  if (desde) { w += ' AND s.fecha >= ?'; p.push(desde); }
  if (hasta) { w += ' AND s.fecha <= ?'; p.push(hasta); }
  if (tipo) { w += ' AND s.tipo = ?'; p.push(tipo); }
  if (grupo_id) { w += ' AND s.grupo_id = ?'; p.push(grupo_id); }
  let etiqueta = '';
  if (horario_id) {                                   // informe de una eucaristía / reunión en particular
    const h = await one('SELECT nombre FROM horarios_culto WHERE id = ?', [horario_id]);
    if (!h) return res.status(400).json({ error: 'La eucaristía o reunión seleccionada no existe' });
    w += " AND s.tipo = 'culto' AND s.horario_id = ?"; p.push(horario_id); etiqueta = h.nombre;
  }
  if (sesion_id) {                                    // informe de la lista de un día concreto
    w += ' AND s.id = ?'; p.push(sesion_id);
    const sn = await one('SELECT nombre, fecha FROM sesiones_asistencia WHERE id = ?', [sesion_id]);
    if (sn) etiqueta = `${sn.nombre} (${sn.fecha})`;
  }
  const filas = await q(`SELECT s.fecha, s.tipo, s.nombre,
      COALESCE(CONCAT(m.apellidos,' ',m.nombres), CONCAT('(Visitante) ', a.visitante_nombre)) AS persona, a.estado,
      IF(a.origen = 'qr', 'QR', 'Manual') AS origen, COALESCE(a.observacion,'') AS observacion
    FROM sesiones_asistencia s JOIN asistencias a ON a.sesion_id = s.id LEFT JOIN miembros m ON m.id = a.miembro_id
    ${w} ORDER BY s.fecha DESC, s.nombre, persona`, p);
  await auditar(req, 'reporte', 'asistencia', null, `${filas.length} filas`);
  const n = (e) => filas.filter(f => f.estado === e).length;
  const resumen = `Presentes: ${n('presente')} · Ausentes: ${n('ausente')} · Justificados: ${n('justificado')} · Visitantes: ${n('visitante')}`;
  const periodo = sesion_id ? '' : `Periodo: ${desde || 'inicio'} a ${hasta || 'hoy'}`;
  await entregar(res, fmt(req), `reporte_asistencia${etiqueta ? '_' + slug(etiqueta) : ''}`,
    etiqueta ? `Asistencia · ${etiqueta}` : 'Reporte de asistencia',
    [etiqueta ? `Eucaristía / reunión: ${etiqueta}` : '', periodo, resumen].filter(Boolean).join('  |  '),
    [{ t: 'Fecha', k: 'fecha', w: 12 }, { t: 'Tipo', k: 'tipo', w: 10 }, { t: 'Reunión', k: 'nombre', w: 26 }, { t: 'Persona', k: 'persona', w: 32 }, { t: 'Estado', k: 'estado', w: 12 }, { t: 'Registro', k: 'origen', w: 10 }, { t: 'Observación', k: 'observacion', w: 22 }], filas);
}));

router.get('/cumpleanos', wrap(async (req, res) => {
  if (!can(req.user, 'reportes.cumpleanos')) return res.status(403).json({ error: 'No tiene permiso' });
  const mes = Math.min(12, Math.max(0, parseInt(req.query.mes) || 0));
  const filas = (await q(`SELECT CONCAT(apellidos,' ',nombres) nombre, fecha_nacimiento, celular, estado FROM miembros
      WHERE estado='activo' AND fecha_nacimiento IS NOT NULL ${mes ?'AND MONTH(fecha_nacimiento)=?' : ''} ORDER BY MONTH(fecha_nacimiento), DAY(fecha_nacimiento), apellidos`, mes ? [mes] : []))
    .map(f => { const [y, m, d] = f.fecha_nacimiento.split('-').map(Number); return { ...f, cumple: `${d} de ${MESES[m - 1]}`, edad_actual: new Date().getFullYear() - y }; });
  const puedeTel = can(req.user, 'discipulos.sensibles');
  await auditar(req, 'reporte', 'cumpleanos', null, '');
  await entregar(res, fmt(req), 'listado_cumpleanos', 'Listado de cumpleaños', mes ? `Mes: ${MESES[mes - 1]}` : 'Todos los meses',
    [{ t: 'Nombre', k: 'nombre', w: 34 }, { t: 'Cumpleaños', k: 'cumple', w: 18 }, { t: 'Edad que cumple', k: 'edad_actual', w: 14 }, ...(puedeTel ? [{ t: 'Celular', k: 'celular', w: 16 }] : [])], filas);
}));

router.get('/grupos', wrap(async (req, res) => {
  if (!can(req.user, 'reportes.ver')) return res.status(403).json({ error: 'No tiene permiso' });
  const g = await gruposPermitidos(req.user);
  if (g !== null && !g.length) return entregar(res, fmt(req), 'grupos_comunion', 'Grupos de comunión familiar', '', [{ t: 'Grupo', k: 'grupo' }], []);
  const filas = await q(`SELECT g.nombre AS grupo, COALESCE(CONCAT(d.nombres,' ',d.apellidos),'Sin asignar') AS discipulador,
      CONCAT(m.apellidos,' ',m.nombres) AS integrante, m.celular, g.estado
    FROM grupos_comunion g LEFT JOIN miembros d ON d.id = g.discipulador_id
    LEFT JOIN grupo_miembro gm ON gm.grupo_id = g.id AND gm.fecha_salida IS NULL LEFT JOIN miembros m ON m.id = gm.miembro_id
    ${g === null ? '' : 'WHERE g.id IN (?)'} ORDER BY g.nombre, m.apellidos`, g === null ? [] : [g]);
  const puedeTel = can(req.user, 'discipulos.sensibles');
  filas.forEach(f => { f.integrante = f.integrante || '(sin integrantes)'; f.estado = f.estado === 'listo_nueva_iglesia' ? 'Listo para nueva iglesia' : f.estado; });
  await auditar(req, 'reporte', 'grupos', null, '');
  await entregar(res, fmt(req), 'grupos_comunion_familiar', 'Grupos de comunión familiar', 'Discípulos activos por grupo',
    [{ t: 'Grupo', k: 'grupo', w: 22 }, { t: 'Discipulador', k: 'discipulador', w: 26 }, { t: 'Discípulo', k: 'integrante', w: 30 }, ...(puedeTel ? [{ t: 'Celular', k: 'celular', w: 16 }] : []), { t: 'Estado del grupo', k: 'estado', w: 20 }], filas);
}));

module.exports = router;
