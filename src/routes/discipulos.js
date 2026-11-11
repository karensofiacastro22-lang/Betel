// Discípulos de la iglesia (en la base de datos se guardan en la tabla "miembros")
const router = require('express').Router();
const { q, one } = require('../db');
const { can, requiereLogin, requierePermiso, wrap, gruposPermitidos, auditar } = require('../auth');

router.use(requiereLogin);

const SENSIBLES = ['tipo_identificacion', 'numero_identificacion', 'celular', 'correo', 'direccion',
  'fecha_nacimiento', 'grupo_sanguineo', 'eps', 'contacto_emergencia', 'celular_emergencia',
  'autoriza_datos', 'fecha_autorizacion', 'medio_autorizacion'];

function filtrar(m, user) {
  if (!can(user, 'discipulos.sensibles')) SENSIBLES.forEach(c => delete m[c]);
  if (!can(user, 'discipulos.confidencial')) delete m.nota_confidencial;
  return m;
}

// Condición SQL que limita a un discipulador a los discípulos de sus grupos
async function alcance(user) {
  const g = await gruposPermitidos(user);
  if (g === null) return { sql: '', params: [] };
  if (!g.length) return { sql: ' AND 1=0', params: [] };
  return {
    sql: ` AND (m.id IN (SELECT miembro_id FROM grupo_miembro WHERE fecha_salida IS NULL AND grupo_id IN (?)) OR m.id = ?)`,
    params: [g, user.miembro_id]
  };
}

const CAMPOS = ['nombres', 'apellidos', 'tipo_identificacion', 'numero_identificacion', 'celular', 'correo',
  'direccion', 'grupo_sanguineo', 'eps', 'fecha_nacimiento', 'nivel_jerarquia_id', 'funcion_iglesia', 'sede_id',
  'supervisor_id', 'contacto_emergencia', 'celular_emergencia', 'estado', 'nota_confidencial',
  'autoriza_datos', 'fecha_autorizacion', 'medio_autorizacion'];

function limpiar(body, user) {
  const d = {};
  for (const c of CAMPOS) {
    if (body[c] === undefined) continue;
    if (c === 'nota_confidencial' && !can(user, 'discipulos.confidencial')) continue;
    if (c === 'estado' && !can(user, 'discipulos.estado')) continue;
    let v = body[c];
    if (typeof v === 'string') v = v.trim();
    d[c] = (v === '' ? null : v);
  }
  if (d.autoriza_datos !== undefined) d.autoriza_datos = d.autoriza_datos ? 1 : 0;
  return d;
}

function validar(d, creando) {
  if (creando) {
    for (const [c, n] of [['nombres', 'Nombres'], ['apellidos', 'Apellidos'], ['numero_identificacion', 'Identificación'],
      ['celular', 'Celular'], ['fecha_nacimiento', 'Fecha de cumpleaños']])
      if (!d[c]) return `${n} es obligatorio`;
  } else {
    for (const c of ['nombres', 'apellidos', 'numero_identificacion', 'celular', 'fecha_nacimiento'])
      if (d[c] === null) return 'Nombre, identificación, celular y fecha de cumpleaños no pueden quedar vacíos';
  }
  if (d.fecha_nacimiento && !/^\d{4}-\d{2}-\d{2}$/.test(d.fecha_nacimiento)) return 'Fecha inválida (use AAAA-MM-DD)';
  return null;
}

router.get('/', requierePermiso('discipulos.ver'), wrap(async (req, res) => {
  const { buscar, estado, sede_id, grupo_id, ministerio_id, nivel_id } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const size = Math.min(100, Math.max(5, parseInt(req.query.size) || 25));
  const sens = can(req.user, 'discipulos.sensibles');
  const al = await alcance(req.user);
  let w = ' WHERE 1=1' + al.sql; const p = [...al.params];
  if (estado) { w += ' AND m.estado = ?'; p.push(estado); }
  if (sede_id) { w += ' AND m.sede_id = ?'; p.push(sede_id); }
  if (nivel_id) { w += ' AND m.nivel_jerarquia_id = ?'; p.push(nivel_id); }
  if (grupo_id) { w += ' AND m.id IN (SELECT miembro_id FROM grupo_miembro WHERE grupo_id = ? AND fecha_salida IS NULL)'; p.push(grupo_id); }
  if (ministerio_id) { w += ' AND m.id IN (SELECT miembro_id FROM miembro_ministerio WHERE ministerio_id = ?)'; p.push(ministerio_id); }
  if (buscar) {
    const like = `%${buscar}%`;
    w += sens ? ' AND (CONCAT(m.nombres," ",m.apellidos) LIKE ? OR m.numero_identificacion LIKE ? OR m.celular LIKE ?)'
              : ' AND CONCAT(m.nombres," ",m.apellidos) LIKE ?';
    p.push(like); if (sens) p.push(like, like);
  }
  // el conteo y la página se consultan en paralelo
  const [conteo, filas] = await Promise.all([
    one(`SELECT COUNT(*) n FROM miembros m ${w}`, p),
    q(`SELECT m.*, s.nombre AS sede, nj.nombre AS nivel,
            (SELECT GROUP_CONCAT(g.nombre SEPARATOR ', ') FROM grupo_miembro gm JOIN grupos_comunion g ON g.id = gm.grupo_id
              WHERE gm.miembro_id = m.id AND gm.fecha_salida IS NULL) AS grupos
       FROM miembros m JOIN sedes s ON s.id = m.sede_id
       LEFT JOIN niveles_jerarquia nj ON nj.id = m.nivel_jerarquia_id
       ${w} ORDER BY m.apellidos, m.nombres LIMIT ? OFFSET ?`, [...p, size, (page - 1) * size])
  ]);
  res.json({ total: conteo.n, page, size, filas: filas.map(m => filtrar(m, req.user)) });
}));

// lista corta para selectores (id + nombre)
router.get('/opciones', wrap(async (req, res) => {
  // quien gestiona grupos necesita poder elegir cualquier discípulo activo (solo nombre, sin datos sensibles)
  const al = can(req.user, 'grupos.gestionar') ? { sql: '', params: [] } : await alcance(req.user);
  const r = await q(`SELECT m.id, CONCAT(m.nombres,' ',m.apellidos) AS nombre, m.nivel_jerarquia_id
                       FROM miembros m WHERE m.estado = 'activo' ${al.sql} ORDER BY m.apellidos, m.nombres`, al.params);
  res.json(r);
}));

router.get('/:id', requierePermiso('discipulos.ver'), wrap(async (req, res) => {
  const al = await alcance(req.user);
  const m = await one(
    `SELECT m.*, s.nombre AS sede, nj.nombre AS nivel, CONCAT(sup.nombres,' ',sup.apellidos) AS supervisor
       FROM miembros m JOIN sedes s ON s.id = m.sede_id
       LEFT JOIN niveles_jerarquia nj ON nj.id = m.nivel_jerarquia_id
       LEFT JOIN miembros sup ON sup.id = m.supervisor_id
      WHERE m.id = ? ${al.sql}`, [req.params.id, ...al.params]);
  if (!m) return res.status(404).json({ error: 'Discípulo no encontrado' });
  const [ministerios, formacion, grupos, resumen] = await Promise.all([
    q(`SELECT mi.id, mi.nombre FROM miembro_ministerio mm JOIN ministerios mi ON mi.id = mm.ministerio_id WHERE mm.miembro_id = ?`, [m.id]),
    q(`SELECT f.*, p.nombre AS programa FROM miembro_formacion f JOIN programas_formacion p ON p.id = f.programa_id WHERE f.miembro_id = ? ORDER BY f.id DESC`, [m.id]),
    q(`SELECT g.id, g.nombre, gm.fecha_ingreso FROM grupo_miembro gm JOIN grupos_comunion g ON g.id = gm.grupo_id WHERE gm.miembro_id = ? AND gm.fecha_salida IS NULL`, [m.id]),
    one(`SELECT COUNT(*) total, SUM(estado='presente') presentes, SUM(estado='ausente') ausentes FROM asistencias WHERE miembro_id = ?`, [m.id])
  ]);
  Object.assign(m, { ministerios, formacion, grupos, resumen_asistencia: resumen });
  res.json(filtrar(m, req.user));
}));

router.post('/', requierePermiso('discipulos.editar'), wrap(async (req, res) => {
  const d = limpiar(req.body || {}, req.user);
  const err = validar(d, true);
  if (err) return res.status(400).json({ error: err });
  if (!d.sede_id) d.sede_id = (await one('SELECT id FROM sedes WHERE es_local = 1 LIMIT 1')).id;
  const cols = Object.keys(d);
  const r = await q(`INSERT INTO miembros (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, cols.map(c => d[c]));
  await auditar(req, 'crear', 'discipulos', r.insertId, `${d.nombres} ${d.apellidos}`);
  res.status(201).json({ id: r.insertId });
}));

router.put('/:id', requierePermiso('discipulos.editar'), wrap(async (req, res) => {
  const d = limpiar(req.body || {}, req.user);
  const err = validar(d, false);
  if (err) return res.status(400).json({ error: err });
  const actual = await one('SELECT id, supervisor_id FROM miembros WHERE id = ?', [req.params.id]);
  if (!actual) return res.status(404).json({ error: 'Discípulo no encontrado' });
  if (d.supervisor_id && Number(d.supervisor_id) === actual.id) return res.status(400).json({ error: 'Un discípulo no puede ser su propio supervisor' });
  const cols = Object.keys(d);
  if (cols.length) await q(`UPDATE miembros SET ${cols.map(c => c + '=?').join(',')} WHERE id = ?`, [...cols.map(c => d[c]), actual.id]);
  if (d.supervisor_id !== undefined && Number(d.supervisor_id || 0) !== Number(actual.supervisor_id || 0))
    await q('INSERT INTO historial_cobertura (miembro_id, supervisor_anterior_id, supervisor_nuevo_id) VALUES (?,?,?)',
      [actual.id, actual.supervisor_id, d.supervisor_id || null]);
  await auditar(req, 'editar', 'discipulos', actual.id, cols.join(','));
  res.json({ ok: true });
}));

router.patch('/:id/estado', requierePermiso('discipulos.estado'), wrap(async (req, res) => {
  const { estado } = req.body || {};
  if (!['activo', 'inactivo', 'retirado'].includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
  await q('UPDATE miembros SET estado = ? WHERE id = ?', [estado, req.params.id]);
  await auditar(req, 'estado', 'discipulos', req.params.id, estado);
  res.json({ ok: true });
}));

router.delete('/:id', requierePermiso('registros.eliminar'), wrap(async (req, res) => {
  const r = await q('DELETE FROM miembros WHERE id = ?', [req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Discípulo no encontrado' });
  await auditar(req, 'eliminar', 'discipulos', req.params.id, '');
  res.json({ ok: true });
}));

// Ministerios (un discípulo puede estar en varios)
router.put('/:id/ministerios', requierePermiso('discipulos.editar'), wrap(async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  await q('DELETE FROM miembro_ministerio WHERE miembro_id = ?', [req.params.id]);
  if (ids.length)
    await q('INSERT IGNORE INTO miembro_ministerio (miembro_id, ministerio_id, desde) SELECT ?, id, CURDATE() FROM ministerios WHERE id IN (?)',
      [req.params.id, ids]);
  await auditar(req, 'ministerios', 'discipulos', req.params.id, ids.join(','));
  res.json({ ok: true });
}));

// Formación: discipulado / adiestramiento
router.post('/:id/formacion', requierePermiso('discipulos.editar'), wrap(async (req, res) => {
  const { programa_id, nivel, estado, fecha_inicio, fecha_fin } = req.body || {};
  if (!programa_id) return res.status(400).json({ error: 'Seleccione el programa' });
  const r = await q('INSERT INTO miembro_formacion (miembro_id, programa_id, nivel, estado, fecha_inicio, fecha_fin) VALUES (?,?,?,?,?,?)',
    [req.params.id, programa_id, nivel || null, estado || 'en_curso', fecha_inicio || null, fecha_fin || null]);
  res.status(201).json({ id: r.insertId });
}));
router.put('/:id/formacion/:fid', requierePermiso('discipulos.editar'), wrap(async (req, res) => {
  const { nivel, estado, fecha_inicio, fecha_fin } = req.body || {};
  await q('UPDATE miembro_formacion SET nivel=?, estado=?, fecha_inicio=?, fecha_fin=? WHERE id=? AND miembro_id=?',
    [nivel || null, estado || 'en_curso', fecha_inicio || null, fecha_fin || null, req.params.fid, req.params.id]);
  res.json({ ok: true });
}));
router.delete('/:id/formacion/:fid', requierePermiso('registros.eliminar'), wrap(async (req, res) => {
  await q('DELETE FROM miembro_formacion WHERE id=? AND miembro_id=?', [req.params.fid, req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;
