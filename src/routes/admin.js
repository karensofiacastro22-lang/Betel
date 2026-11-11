const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { q, one } = require('../db');
const { can, requiereLogin, requierePermiso, wrap, auditar } = require('../auth');

router.use(requiereLogin);

// ---------- Catálogos para formularios ----------
router.get('/catalogos', wrap(async (_req, res) => {
  const [roles, niveles, ministerios, programas, sedes] = await Promise.all([
    q('SELECT id, codigo, nombre FROM roles ORDER BY id'),
    q('SELECT id, orden, nombre FROM niveles_jerarquia ORDER BY orden'),
    q('SELECT id, nombre FROM ministerios WHERE activo=1 ORDER BY nombre'),
    q('SELECT id, nombre FROM programas_formacion ORDER BY nombre'),
    q('SELECT id, nombre, es_local FROM sedes WHERE activa=1 ORDER BY es_local DESC, nombre')
  ]);
  res.json({ roles, niveles, ministerios, programas, sedes });
}));

// ---------- Panel principal ----------
router.get('/dashboard', wrap(async (req, res) => {
  const out = {};
  const tareas = [];   // todas las consultas del panel se ejecutan en paralelo
  if (can(req.user, 'estadisticas.ver')) {
    tareas.push(
      one(`SELECT COUNT(*) total, SUM(estado='activo') activos, SUM(estado='inactivo') inactivos, SUM(estado='retirado') retirados FROM miembros`).then(r => { out.discipulos = r; }),
      one(`SELECT COUNT(*) total, SUM(estado='listo_nueva_iglesia') llenos FROM grupos_comunion WHERE estado <> 'inactivo'`).then(r => { out.grupos = r; }),
      q(`SELECT s.id, s.nombre, s.fecha, SUM(a.estado='presente') presentes, SUM(a.estado='ausente') ausentes,
          SUM(a.estado='justificado') justificados, SUM(a.estado='visitante') visitantes
        FROM sesiones_asistencia s JOIN asistencias a ON a.sesion_id = s.id WHERE s.tipo='culto'
        GROUP BY s.id ORDER BY s.fecha DESC, s.id DESC LIMIT 8`).then(r => { out.asistencia = r.reverse(); }),
      (can(req.user, 'reportes.cumpleanos') ? q(
        `SELECT id, CONCAT(nombres,' ',apellidos) nombre, fecha_nacimiento, DAY(fecha_nacimiento) dia
           FROM miembros WHERE estado='activo' AND MONTH(fecha_nacimiento) = MONTH(CURDATE()) ORDER BY DAY(fecha_nacimiento)`) : Promise.resolve([]))
        .then(r => { out.cumpleanos = r; })
    );
  }
  if (can(req.user, 'alertas.ver'))
    tareas.push(one("SELECT COUNT(*) n FROM alertas_inasistencia WHERE estado='pendiente'").then(r => { out.alertas_pendientes = r.n; }));
  tareas.push(q(`SELECT id, titulo, fecha, TIME_FORMAT(hora,'%H:%i') hora, estado FROM eventos WHERE fecha >= CURDATE() AND estado <> 'cancelado' ORDER BY fecha, hora LIMIT 5`)
    .then(r => { out.proximos_eventos = r; }));
  await Promise.all(tareas);
  res.json(out);
}));

// ---------- Alertas de inasistencia ----------
router.get('/alertas', requierePermiso('alertas.ver'), wrap(async (req, res) => {
  const estado = req.query.estado === 'atendida' ? 'atendida' : 'pendiente';
  res.json(await q(`SELECT a.*, CONCAT(m.nombres,' ',m.apellidos) AS discipulo, m.celular, g.nombre AS grupo
      FROM alertas_inasistencia a JOIN miembros m ON m.id = a.miembro_id
      LEFT JOIN grupos_comunion g ON g.id = a.grupo_id
      WHERE a.estado = ? ORDER BY a.ultima_fecha DESC LIMIT 200`, [estado]));
}));
router.patch('/alertas/:id', requierePermiso('alertas.ver'), wrap(async (req, res) => {
  await q("UPDATE alertas_inasistencia SET estado='atendida', nota_seguimiento=?, atendida_por=?, atendida_en=NOW() WHERE id=?",
    [String(req.body.nota || '').slice(0, 500) || null, req.user.id, req.params.id]);
  await auditar(req, 'atender_alerta', 'alertas_inasistencia', req.params.id, '');
  res.json({ ok: true });
}));

// ---------- Usuarios del sistema ----------
router.get('/usuarios', requierePermiso('admin.sistema'), wrap(async (_req, res) => {
  res.json(await q(`SELECT u.id, u.nombre, u.correo, u.activo, u.miembro_id AS discipulo_id, u.ultimo_acceso, r.id rol_id, r.nombre rol
      FROM usuarios u JOIN roles r ON r.id = u.rol_id ORDER BY u.nombre`));
}));
// el discípulo vinculado se guarda en la columna usuarios.miembro_id
const discipuloVinculado = (b) => b.discipulo_id ?? b.miembro_id;
router.post('/usuarios', requierePermiso('admin.sistema'), wrap(async (req, res) => {
  const { nombre, correo, password, rol_id } = req.body || {};
  const miembro_id = discipuloVinculado(req.body || {});
  if (!nombre || !correo || !rol_id) return res.status(400).json({ error: 'Nombre, correo y rol son obligatorios' });
  if (!password || String(password).length < 8) return res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres' });
  const r = await q('INSERT INTO usuarios (nombre, correo, password_hash, rol_id, miembro_id) VALUES (?,?,?,?,?)',
    [String(nombre).trim(), String(correo).trim().toLowerCase(), await bcrypt.hash(String(password), 10), rol_id, miembro_id || null]);
  await auditar(req, 'crear', 'usuarios', r.insertId, correo);
  res.status(201).json({ id: r.insertId });
}));
router.put('/usuarios/:id', requierePermiso('admin.sistema'), wrap(async (req, res) => {
  const { nombre, correo, password, rol_id, activo } = req.body || {};
  const miembro_id = discipuloVinculado(req.body || {});
  if (Number(req.params.id) === req.user.id && activo === false) return res.status(400).json({ error: 'No puede desactivar su propio usuario' });
  if (password && String(password).length < 8) return res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres' });
  await q('UPDATE usuarios SET nombre=?, correo=?, rol_id=?, miembro_id=?, activo=? WHERE id=?',
    [nombre, String(correo).trim().toLowerCase(), rol_id, miembro_id || null, activo === false ? 0 : 1, req.params.id]);
  if (password) {
    await q('UPDATE usuarios SET password_hash=? WHERE id=?', [await bcrypt.hash(String(password), 10), req.params.id]);
  }
  await auditar(req, 'editar', 'usuarios', req.params.id, '');
  res.json({ ok: true });
}));

// ---------- Sedes ----------
router.get('/sedes', wrap(async (_req, res) => res.json(await q('SELECT * FROM sedes ORDER BY es_local DESC, es_principal DESC, nombre'))));
const CS = ['nombre', 'ciudad', 'pais', 'direccion', 'telefono', 'correo', 'descripcion'];
router.post('/sedes', requierePermiso('admin.sistema'), wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.nombre || !b.pais) return res.status(400).json({ error: 'Nombre y país son obligatorios' });
  const cols = CS.filter(c => b[c] !== undefined); cols.push('es_principal', 'activa');
  const r = await q(`INSERT INTO sedes (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
    [...cols.slice(0, -2).map(c => b[c] || null), b.es_principal ? 1 : 0, b.activa === false ? 0 : 1]);
  await auditar(req, 'crear', 'sedes', r.insertId, b.nombre);
  res.status(201).json({ id: r.insertId });
}));
router.put('/sedes/:id', requierePermiso('admin.sistema'), wrap(async (req, res) => {
  const b = req.body || {};
  await q(`UPDATE sedes SET ${CS.map(c => c + '=?').join(',')}, es_principal=?, activa=? WHERE id=?`,
    [...CS.map(c => b[c] || null), b.es_principal ? 1 : 0, b.activa === false ? 0 : 1, req.params.id]);
  await auditar(req, 'editar', 'sedes', req.params.id, '');
  res.json({ ok: true });
}));
router.delete('/sedes/:id', requierePermiso('admin.sistema'), wrap(async (req, res) => {
  const s = await one('SELECT es_local FROM sedes WHERE id=?', [req.params.id]);
  if (s && s.es_local) return res.status(400).json({ error: 'No se puede eliminar la sede local' });
  await q('DELETE FROM sedes WHERE id=?', [req.params.id]);
  await auditar(req, 'eliminar', 'sedes', req.params.id, '');
  res.json({ ok: true });
}));

// ---------- Horarios de culto (sede local) ----------
router.get('/horarios', wrap(async (_req, res) => res.json(await q(
  `SELECT h.id, h.nombre, h.dia_semana, TIME_FORMAT(h.hora,'%H:%i') hora, h.modalidad, h.plataforma, h.activo
     FROM horarios_culto h JOIN sedes s ON s.id = h.sede_id WHERE s.es_local=1 ORDER BY h.dia_semana, h.hora`))));
router.post('/horarios', requierePermiso('admin.sistema'), wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.nombre || b.dia_semana === undefined || !b.hora) return res.status(400).json({ error: 'Nombre, día y hora son obligatorios' });
  const sede = await one('SELECT id FROM sedes WHERE es_local=1 LIMIT 1');
  const r = await q('INSERT INTO horarios_culto (sede_id, nombre, dia_semana, hora, modalidad, plataforma) VALUES (?,?,?,?,?,?)',
    [sede.id, b.nombre, b.dia_semana, b.hora, b.modalidad || 'presencial', b.plataforma || null]);
  res.status(201).json({ id: r.insertId });
}));
router.put('/horarios/:id', requierePermiso('admin.sistema'), wrap(async (req, res) => {
  const b = req.body || {};
  await q('UPDATE horarios_culto SET nombre=?, dia_semana=?, hora=?, modalidad=?, plataforma=?, activo=? WHERE id=?',
    [b.nombre, b.dia_semana, b.hora, b.modalidad || 'presencial', b.plataforma || null, b.activo === false ? 0 : 1, req.params.id]);
  res.json({ ok: true });
}));
router.delete('/horarios/:id', requierePermiso('admin.sistema'), wrap(async (req, res) => {
  await q('DELETE FROM horarios_culto WHERE id=?', [req.params.id]); res.json({ ok: true });
}));

// ---------- Ministerios ----------
router.post('/ministerios', requierePermiso('admin.sistema'), wrap(async (req, res) => {
  if (!req.body.nombre) return res.status(400).json({ error: 'Nombre obligatorio' });
  const r = await q('INSERT INTO ministerios (nombre, descripcion) VALUES (?,?)', [req.body.nombre.trim(), req.body.descripcion || null]);
  res.status(201).json({ id: r.insertId });
}));
router.delete('/ministerios/:id', requierePermiso('admin.sistema'), wrap(async (req, res) => {
  await q('DELETE FROM ministerios WHERE id=?', [req.params.id]); res.json({ ok: true });
}));

// ---------- Jerarquía pastoral (árbol de cobertura) ----------
router.get('/jerarquia', requierePermiso('discipulos.sensibles'), wrap(async (_req, res) => {
  res.json(await q(`SELECT m.id, CONCAT(m.nombres,' ',m.apellidos) nombre, m.supervisor_id, nj.orden, nj.nombre nivel, m.estado
      FROM miembros m JOIN niveles_jerarquia nj ON nj.id = m.nivel_jerarquia_id
      WHERE m.estado <> 'retirado' ORDER BY nj.orden, m.apellidos`));
}));

// ---------- Bitácora ----------
router.get('/bitacora', requierePermiso('admin.sistema'), wrap(async (_req, res) => {
  res.json(await q(`SELECT b.id, b.fecha, b.accion, b.entidad, b.entidad_id, b.detalle, u.nombre usuario
      FROM bitacora b LEFT JOIN usuarios u ON u.id = b.usuario_id ORDER BY b.id DESC LIMIT 200`));
}));

module.exports = router;
