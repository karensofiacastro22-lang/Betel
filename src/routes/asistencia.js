const router = require('express').Router();
const crypto = require('crypto');
const QRCode = require('qrcode');
const { q, one } = require('../db');
const { can, requiereLogin, requierePermiso, wrap, gruposPermitidos, auditar } = require('../auth');

router.use(requiereLogin);

const ESTADOS = ['presente', 'ausente', 'justificado', 'visitante'];
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Código único e impredecible de cada lista (eucaristía/reunión + día). Es lo que lleva el QR.
const nuevoToken = () => crypto.randomBytes(16).toString('hex');

function baseUrl(req) {
  const b = (process.env.BASE_URL || '').trim().replace(/\/+$/, '');
  return b || `${req.protocol}://${req.get('host')}`;
}

async function sedeLocal() { return (await one('SELECT id FROM sedes WHERE es_local = 1 LIMIT 1')).id; }

async function puedeSesion(user, ses) {
  const g = await gruposPermitidos(user);
  if (g === null) return true;
  return ses.tipo === 'grupo' && g.includes(ses.grupo_id);
}

router.get('/sesiones', requierePermiso('asistencia.registrar'), wrap(async (req, res) => {
  const { tipo, desde, hasta } = req.query;
  const g = await gruposPermitidos(req.user);
  let w = ' WHERE 1=1'; const p = [];
  if (g !== null) { if (!g.length) return res.json([]); w += " AND s.tipo='grupo' AND s.grupo_id IN (?)"; p.push(g); }
  if (tipo) { w += ' AND s.tipo = ?'; p.push(tipo); }
  if (desde) { w += ' AND s.fecha >= ?'; p.push(desde); }
  if (hasta) { w += ' AND s.fecha <= ?'; p.push(hasta); }
  res.json(await q(`SELECT s.*,
      SUM(a.estado='presente') presentes, SUM(a.estado='ausente') ausentes,
      SUM(a.estado='justificado') justificados, SUM(a.estado='visitante') visitantes
    FROM sesiones_asistencia s LEFT JOIN asistencias a ON a.sesion_id = s.id
    ${w} GROUP BY s.id ORDER BY s.fecha DESC, s.id DESC LIMIT 100`, p));
}));

// Crea la sesión (o devuelve la existente para ese culto/evento/grupo y fecha)
router.post('/sesiones', requierePermiso('asistencia.registrar'), wrap(async (req, res) => {
  const { tipo, fecha, horario_id, evento_id, grupo_id } = req.body || {};
  if (!['culto', 'evento', 'grupo'].includes(tipo) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha || ''))
    return res.status(400).json({ error: 'Tipo y fecha son obligatorios' });
  let nombre, h = null, e = null, gr = null;
  if (tipo === 'culto') {
    const r = await one('SELECT id, nombre FROM horarios_culto WHERE id=?', [horario_id]);
    if (!r) return res.status(400).json({ error: 'Seleccione el culto o reunión' });
    nombre = r.nombre; h = r.id;
  } else if (tipo === 'evento') {
    const r = await one('SELECT id, titulo FROM eventos WHERE id=?', [evento_id]);
    if (!r) return res.status(400).json({ error: 'Seleccione el evento' });
    nombre = r.titulo; e = r.id;
  } else {
    const r = await one('SELECT id, nombre FROM grupos_comunion WHERE id=?', [grupo_id]);
    if (!r) return res.status(400).json({ error: 'Seleccione el grupo' });
    nombre = r.nombre; gr = r.id;
  }
  if (!(await puedeSesion(req.user, { tipo, grupo_id: gr }))) return res.status(403).json({ error: 'No tiene acceso a esta asistencia' });
  const ya = await one('SELECT id FROM sesiones_asistencia WHERE tipo=? AND fecha=? AND horario_id<=>? AND evento_id<=>? AND grupo_id<=>?', [tipo, fecha, h, e, gr]);
  if (ya) return res.json({ id: ya.id, existente: true });
  const r = await q('INSERT INTO sesiones_asistencia (tipo, nombre, fecha, sede_id, horario_id, evento_id, grupo_id, creado_por, token_qr) VALUES (?,?,?,?,?,?,?,?,?)',
    [tipo, nombre, fecha, await sedeLocal(), h, e, gr, req.user.id, nuevoToken()]);
  await auditar(req, 'crear', 'sesiones_asistencia', r.insertId, `${nombre} ${fecha}`);
  res.status(201).json({ id: r.insertId });
}));

router.get('/sesiones/:id', requierePermiso('asistencia.registrar'), wrap(async (req, res) => {
  const s = await one('SELECT * FROM sesiones_asistencia WHERE id=?', [req.params.id]);
  if (!s) return res.status(404).json({ error: 'Sesión no encontrada' });
  if (!(await puedeSesion(req.user, s))) return res.status(403).json({ error: 'No tiene acceso a esta asistencia' });
  let base, p = [];
  if (s.tipo === 'grupo') {
    base = `SELECT m.id, m.nombres, m.apellidos FROM miembros m
             JOIN grupo_miembro gm ON gm.miembro_id = m.id AND gm.grupo_id = ? AND gm.fecha_salida IS NULL
            WHERE m.estado='activo'`; p = [s.grupo_id];
  } else {
    base = `SELECT m.id, m.nombres, m.apellidos FROM miembros m WHERE m.estado='activo' AND m.sede_id = ?`; p = [s.sede_id];
    const g = await gruposPermitidos(req.user);
    if (g !== null) { base += ' AND m.id IN (SELECT miembro_id FROM grupo_miembro WHERE fecha_salida IS NULL AND grupo_id IN (?))'; p.push(g.length ? g : [0]); }
  }
  const [esperados, regs] = await Promise.all([
    q(`${base} ORDER BY m.apellidos, m.nombres`, p),
    q('SELECT * FROM asistencias WHERE sesion_id=?', [s.id])
  ]);
  const porDiscipulo = new Map(regs.filter(r => r.miembro_id).map(r => [r.miembro_id, r]));
  const lista = esperados.map(m => {
    const r = porDiscipulo.get(m.id); porDiscipulo.delete(m.id);
    return { discipulo_id: m.id, nombre: `${m.apellidos} ${m.nombres}`, estado: r ? r.estado : null, observacion: r ? r.observacion : null, corregido: !!(r && r.corregido_en), por_qr: !!(r && r.origen === 'qr') };
  });
  // registros de discípulos que ya no están en la lista esperada (p. ej. pasaron a inactivos): una sola consulta
  const sobrantes = [...porDiscipulo.values()];
  if (sobrantes.length) {
    const nombres = new Map((await q('SELECT id, nombres, apellidos FROM miembros WHERE id IN (?)', [sobrantes.map(r => r.miembro_id)]))
      .map(m => [m.id, `${m.apellidos} ${m.nombres}`]));
    for (const r of sobrantes)
      lista.push({ discipulo_id: r.miembro_id, nombre: nombres.get(r.miembro_id) || '(eliminado)', estado: r.estado, observacion: r.observacion, corregido: !!r.corregido_en, por_qr: r.origen === 'qr' });
  }
  const visitantes = regs.filter(r => !r.miembro_id).map(r => ({ id: r.id, nombre: r.visitante_nombre, por_qr: r.origen === 'qr' }));
  delete s.token_qr;
  res.json({ sesion: s, lista, visitantes, puede_corregir: can(req.user, 'asistencia.corregir') });
}));

// Guardado masivo de marcas
router.put('/sesiones/:id/registros', requierePermiso('asistencia.registrar'), wrap(async (req, res) => {
  const s = await one('SELECT * FROM sesiones_asistencia WHERE id=?', [req.params.id]);
  if (!s) return res.status(404).json({ error: 'Sesión no encontrada' });
  if (!(await puedeSesion(req.user, s))) return res.status(403).json({ error: 'No tiene acceso a esta asistencia' });
  const { registros = [], visitantes = [] } = req.body || {};
  const puedeCorregir = can(req.user, 'asistencia.corregir');
  const previos = new Map((await q('SELECT miembro_id, estado FROM asistencias WHERE sesion_id=? AND miembro_id IS NOT NULL', [s.id])).map(r => [r.miembro_id, r.estado]));
  let bloqueados = 0; const tocados = [];
  for (const r of registros) {
    const mid = Number(r.discipulo_id);
    if (!mid || !ESTADOS.includes(r.estado) || r.estado === 'visitante') continue;
    const prev = previos.get(mid);
    if (prev && prev !== r.estado && !puedeCorregir) { bloqueados++; continue; }
    const corrige = prev && prev !== r.estado;
    await q(`INSERT INTO asistencias (sesion_id, miembro_id, estado, observacion, registrado_por)
             VALUES (?,?,?,?,?)
             ON DUPLICATE KEY UPDATE estado=VALUES(estado), observacion=VALUES(observacion),
               corregido_por = IF(?, ?, corregido_por), corregido_en = IF(?, NOW(), corregido_en)`,
      [s.id, mid, r.estado, r.observacion ? String(r.observacion).slice(0, 255) : null, req.user.id,
       corrige ? 1 : 0, req.user.id, corrige ? 1 : 0]);
    tocados.push(mid);
  }
  for (const v of visitantes) {
    const n = String(v.nombre || '').trim().slice(0, 150);
    if (n) await q("INSERT INTO asistencias (sesion_id, visitante_nombre, estado, registrado_por) VALUES (?,?, 'visitante', ?)", [s.id, n, req.user.id]);
  }
  await evaluarAlertas(s, tocados);
  await auditar(req, 'asistencia', 'sesiones_asistencia', s.id, `${tocados.length} registros`);
  res.json({ ok: true, guardados: tocados.length, bloqueados });
}));

// ---------- Código QR de la lista (uno por eucaristía/reunión y por día) ----------
router.get('/sesiones/:id/qr', requierePermiso('asistencia.registrar'), wrap(async (req, res) => {
  const s = await one('SELECT * FROM sesiones_asistencia WHERE id=?', [req.params.id]);
  if (!s) return res.status(404).json({ error: 'Sesión no encontrada' });
  if (!(await puedeSesion(req.user, s))) return res.status(403).json({ error: 'No tiene acceso a esta asistencia' });
  if (!s.token_qr) {                       // listas creadas antes de existir el QR
    s.token_qr = nuevoToken();
    await q('UPDATE sesiones_asistencia SET token_qr=? WHERE id=?', [s.token_qr, s.id]);
  }
  const url = `${baseUrl(req)}/a/${s.token_qr}`;
  const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 });
  res.json({ url, svg, nombre: s.nombre, fecha: s.fecha, tipo: s.tipo,
    es_local: /^(localhost|127\.|\[::1\])/.test(new URL(url).hostname) });
}));

// Invalida el QR anterior y crea uno nuevo (por si el código se filtró o se compartió fuera de la iglesia)
router.post('/sesiones/:id/qr/regenerar', requierePermiso('asistencia.corregir'), wrap(async (req, res) => {
  const s = await one('SELECT * FROM sesiones_asistencia WHERE id=?', [req.params.id]);
  if (!s) return res.status(404).json({ error: 'Sesión no encontrada' });
  await q('UPDATE sesiones_asistencia SET token_qr=? WHERE id=?', [nuevoToken(), s.id]);
  await auditar(req, 'regenerar_qr', 'sesiones_asistencia', s.id, `${s.nombre} ${s.fecha}`);
  res.json({ ok: true });
}));

router.delete('/sesiones/:id/visitantes/:aid', requierePermiso('asistencia.corregir'), wrap(async (req, res) => {
  await q('DELETE FROM asistencias WHERE id=? AND sesion_id=? AND miembro_id IS NULL', [req.params.aid, req.params.id]);
  res.json({ ok: true });
}));

router.delete('/sesiones/:id', requierePermiso('registros.eliminar'), wrap(async (req, res) => {
  const s = await one('SELECT * FROM sesiones_asistencia WHERE id=?', [req.params.id]);
  if (!s) return res.status(404).json({ error: 'Sesión no encontrada' });
  if (!(await puedeSesion(req.user, s))) return res.status(403).json({ error: 'No tiene acceso' });
  await q('DELETE FROM sesiones_asistencia WHERE id=?', [s.id]);
  await auditar(req, 'eliminar', 'sesiones_asistencia', s.id, s.nombre);
  res.json({ ok: true });
}));

// Alerta tras 2 inasistencias consecutivas (cultos/reuniones y grupos). Llega al Pastor y a Asistencia Pastoral.
async function evaluarAlertas(s, miembros) {
  if (s.tipo === 'evento') return;
  for (const mid of [...new Set(miembros)]) {
    const filas = await q(
      `SELECT a.estado, s.fecha FROM sesiones_asistencia s JOIN asistencias a ON a.sesion_id = s.id AND a.miembro_id = ?
        WHERE s.tipo = ? AND s.grupo_id <=> ? AND s.horario_id <=> ?
        ORDER BY s.fecha DESC, s.id DESC LIMIT 20`, [mid, s.tipo, s.grupo_id, s.horario_id]);
    let racha = 0;
    for (const f of filas) { if (f.estado === 'ausente') racha++; else break; }
    const pend = await one(`SELECT id FROM alertas_inasistencia WHERE miembro_id=? AND tipo_sesion=? AND grupo_id<=>? AND estado='pendiente'`, [mid, s.tipo, s.grupo_id]);
    if (racha >= 2) {
      if (pend) await q('UPDATE alertas_inasistencia SET faltas_consecutivas=?, ultima_fecha=? WHERE id=?', [racha, filas[0].fecha, pend.id]);
      else await q('INSERT INTO alertas_inasistencia (miembro_id, tipo_sesion, grupo_id, faltas_consecutivas, ultima_fecha) VALUES (?,?,?,?,?)',
        [mid, s.tipo, s.grupo_id, racha, filas[0].fecha]);
    } else if (pend) {
      await q("UPDATE alertas_inasistencia SET estado='atendida', atendida_en=NOW(), nota_seguimiento='Resuelta automáticamente: el discípulo volvió a asistir' WHERE id=?", [pend.id]);
    }
  }
}

router.get('/horarios', requierePermiso('asistencia.registrar'), wrap(async (_req, res) => {
  const r = await q(`SELECT h.id, h.nombre, h.dia_semana, TIME_FORMAT(h.hora,'%H:%i') hora FROM horarios_culto h
                      JOIN sedes s ON s.id=h.sede_id WHERE h.activo=1 AND s.es_local=1 ORDER BY h.dia_semana, h.hora`);
  res.json(r.map(x => ({ ...x, etiqueta: `${x.nombre} · ${DIAS[x.dia_semana]} ${x.hora}` })));
}));

module.exports = router;
module.exports.evaluarAlertas = evaluarAlertas;
