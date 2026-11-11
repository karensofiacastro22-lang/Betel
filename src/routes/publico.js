const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { q, one } = require('../db');
const { wrap } = require('../auth');

// Información pública para el sitio web (sin datos personales)
router.get('/info', wrap(async (_req, res) => {
  const sedes = await q(
    `SELECT id, nombre, ciudad, pais, direccion, telefono, correo, descripcion, es_principal, es_local
       FROM sedes WHERE activa = 1 ORDER BY es_local DESC, es_principal DESC, nombre`);
  const horarios = await q(
    `SELECT h.id, h.nombre, h.dia_semana, TIME_FORMAT(h.hora,'%H:%i') AS hora, h.modalidad, h.plataforma
       FROM horarios_culto h JOIN sedes s ON s.id = h.sede_id
      WHERE h.activo = 1 AND s.es_local = 1 ORDER BY h.dia_semana, h.hora`);
  const eventos = await q(
    `SELECT e.id, e.titulo, e.tipo, e.descripcion, e.fecha, TIME_FORMAT(e.hora,'%H:%i') AS hora, e.lugar,
            e.imagen, e.modalidad, e.url_transmision, e.requiere_inscripcion, e.estado, e.fecha_original
       FROM eventos e WHERE e.publicado = 1 AND e.fecha >= CURDATE() AND e.estado <> 'cancelado'
      ORDER BY e.fecha, e.hora LIMIT 12`);
  res.json({ sedes, horarios, eventos });
}));

const limitador = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

router.post('/eventos/:id/inscripcion', limitador, wrap(async (req, res) => {
  const { nombre, celular, correo } = req.body || {};
  if (!nombre || !celular) return res.status(400).json({ error: 'Nombre y celular son obligatorios' });
  const ev = await one(
    `SELECT id FROM eventos WHERE id = ? AND publicado = 1 AND requiere_inscripcion = 1
        AND estado <> 'cancelado' AND fecha >= CURDATE()`, [req.params.id]);
  if (!ev) return res.status(404).json({ error: 'El evento no admite inscripción' });
  await q('INSERT INTO inscripciones_evento (evento_id, nombre, celular, correo) VALUES (?,?,?,?)',
    [ev.id, String(nombre).slice(0, 150), String(celular).slice(0, 25), correo ? String(correo).slice(0, 120) : null]);
  res.json({ ok: true });
}));

module.exports = router;
