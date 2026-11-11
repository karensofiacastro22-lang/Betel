const router = require('express').Router();
const { q, one } = require('../db');
const { requiereLogin, requierePermiso, wrap, gruposPermitidos, auditar } = require('../auth');

router.use(requiereLogin);

const BASE = `SELECT g.*, s.nombre AS sede, CONCAT(d.nombres,' ',d.apellidos) AS discipulador,
       (SELECT COUNT(*) FROM grupo_miembro gm WHERE gm.grupo_id = g.id AND gm.fecha_salida IS NULL) AS integrantes
  FROM grupos_comunion g JOIN sedes s ON s.id = g.sede_id LEFT JOIN miembros d ON d.id = g.discipulador_id`;

async function puedeVer(user, id) {
  const g = await gruposPermitidos(user);
  return g === null || g.includes(Number(id));
}

// Si el grupo alcanzó el máximo, queda marcado para abrir una nueva iglesia
async function revisarCupo(grupoId) {
  const g = await one(`SELECT g.id, g.estado, g.max_integrantes,
    (SELECT COUNT(*) FROM grupo_miembro WHERE grupo_id = g.id AND fecha_salida IS NULL) n FROM grupos_comunion g WHERE g.id = ?`, [grupoId]);
  if (!g) return null;
  if (g.n >= g.max_integrantes && g.estado === 'activo') await q("UPDATE grupos_comunion SET estado='listo_nueva_iglesia' WHERE id=?", [g.id]);
  if (g.n < g.max_integrantes && g.estado === 'listo_nueva_iglesia') await q("UPDATE grupos_comunion SET estado='activo' WHERE id=?", [g.id]);
  return { n: g.n, max: g.max_integrantes, lleno: g.n >= g.max_integrantes };
}

router.get('/', wrap(async (req, res) => {
  const ids = await gruposPermitidos(req.user);
  if (ids !== null && !ids.length) return res.json([]);
  const w = ids === null ? '' : ' WHERE g.id IN (?)';
  res.json(await q(`${BASE}${w} ORDER BY g.nombre`, ids === null ? [] : [ids]));
}));

router.get('/:id', wrap(async (req, res) => {
  if (!(await puedeVer(req.user, req.params.id))) return res.status(403).json({ error: 'No tiene acceso a este grupo' });
  const g = await one(`${BASE} WHERE g.id = ?`, [req.params.id]);
  if (!g) return res.status(404).json({ error: 'Grupo no encontrado' });
  g.discipulos = await q(`SELECT m.id, CONCAT(m.nombres,' ',m.apellidos) AS nombre, m.estado, gm.fecha_ingreso
    FROM grupo_miembro gm JOIN miembros m ON m.id = gm.miembro_id
    WHERE gm.grupo_id = ? AND gm.fecha_salida IS NULL ORDER BY m.apellidos, m.nombres`, [g.id]);
  res.json(g);
}));

function datos(body, user) {
  const d = {};
  for (const c of ['nombre', 'discipulador_id', 'sede_id', 'dia_reunion', 'hora_reunion', 'lugar', 'max_integrantes', 'estado']) {
    if (body[c] === undefined) continue;
    d[c] = (body[c] === '' ? null : body[c]);
  }
  if (user.rol === 'discipulador') { d.discipulador_id = user.miembro_id; delete d.estado; }
  if (d.max_integrantes !== undefined) d.max_integrantes = Math.max(2, parseInt(d.max_integrantes) || 12);
  return d;
}

router.post('/', requierePermiso('grupos.gestionar'), wrap(async (req, res) => {
  const d = datos(req.body || {}, req.user);
  if (!d.nombre) return res.status(400).json({ error: 'El nombre del grupo es obligatorio' });
  if (req.user.rol === 'discipulador' && !req.user.miembro_id) return res.status(400).json({ error: 'Su usuario no está vinculado a un discípulo' });
  if (!d.sede_id) d.sede_id = (await one('SELECT id FROM sedes WHERE es_local = 1 LIMIT 1')).id;
  d.creado_por = req.user.id;
  const cols = Object.keys(d);
  const r = await q(`INSERT INTO grupos_comunion (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, cols.map(c => d[c]));
  await auditar(req, 'crear', 'grupos_comunion', r.insertId, d.nombre);
  res.status(201).json({ id: r.insertId });
}));

router.put('/:id', requierePermiso('grupos.gestionar'), wrap(async (req, res) => {
  if (!(await puedeVer(req.user, req.params.id))) return res.status(403).json({ error: 'No tiene acceso a este grupo' });
  const d = datos(req.body || {}, req.user);
  const cols = Object.keys(d);
  if (cols.length) await q(`UPDATE grupos_comunion SET ${cols.map(c => c + '=?').join(',')} WHERE id=?`, [...cols.map(c => d[c]), req.params.id]);
  await revisarCupo(req.params.id);
  await auditar(req, 'editar', 'grupos_comunion', req.params.id, cols.join(','));
  res.json({ ok: true });
}));

router.delete('/:id', requierePermiso('registros.eliminar'), wrap(async (req, res) => {
  if (!(await puedeVer(req.user, req.params.id))) return res.status(403).json({ error: 'No tiene acceso a este grupo' });
  await q('DELETE FROM grupos_comunion WHERE id=?', [req.params.id]);
  await auditar(req, 'eliminar', 'grupos_comunion', req.params.id, '');
  res.json({ ok: true });
}));

// Agregar integrante (si estaba en otro grupo, se traslada)
router.post('/:id/discipulos', requierePermiso('grupos.gestionar'), wrap(async (req, res) => {
  if (!(await puedeVer(req.user, req.params.id))) return res.status(403).json({ error: 'No tiene acceso a este grupo' });
  const miembro_id = Number(req.body.discipulo_id);
  if (!miembro_id) return res.status(400).json({ error: 'Seleccione un discípulo' });
  const cupo = await revisarCupo(req.params.id);
  if (!cupo) return res.status(404).json({ error: 'Grupo no encontrado' });
  const ya = await one('SELECT id FROM grupo_miembro WHERE grupo_id=? AND miembro_id=? AND fecha_salida IS NULL', [req.params.id, miembro_id]);
  if (ya) return res.status(409).json({ error: 'El discípulo ya está en este grupo' });
  if (cupo.lleno) return res.status(409).json({ error: `El grupo alcanzó su máximo (${cupo.max}). Corresponde abrir una nueva iglesia con este grupo.` });
  const previo = await q('UPDATE grupo_miembro SET fecha_salida = CURDATE() WHERE miembro_id=? AND fecha_salida IS NULL', [miembro_id]);
  await q('INSERT INTO grupo_miembro (grupo_id, miembro_id, fecha_ingreso) VALUES (?,?,CURDATE())', [req.params.id, miembro_id]);
  const estado = await revisarCupo(req.params.id);
  await auditar(req, 'agregar_integrante', 'grupos_comunion', req.params.id, `discípulo ${miembro_id}`);
  res.status(201).json({ ok: true, trasladado: previo.affectedRows > 0, lleno: estado.lleno, integrantes: estado.n, max: estado.max });
}));

router.delete('/:id/discipulos/:mid', requierePermiso('grupos.gestionar'), wrap(async (req, res) => {
  if (!(await puedeVer(req.user, req.params.id))) return res.status(403).json({ error: 'No tiene acceso a este grupo' });
  await q('UPDATE grupo_miembro SET fecha_salida = CURDATE() WHERE grupo_id=? AND miembro_id=? AND fecha_salida IS NULL', [req.params.id, req.params.mid]);
  await revisarCupo(req.params.id);
  await auditar(req, 'retirar_integrante', 'grupos_comunion', req.params.id, `discípulo ${req.params.mid}`);
  res.json({ ok: true });
}));

module.exports = router;
