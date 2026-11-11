const router = require('express').Router();
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { q, one } = require('../db');
const { requiereLogin, requierePermiso, wrap, auditar } = require('../auth');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'public', 'uploads'),
  filename: (_req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + path.extname(file.originalname).toLowerCase())
});
const subir = multer({
  storage, limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, f, cb) => cb(null, ['image/png', 'image/jpeg', 'image/webp'].includes(f.mimetype))
});

router.use(requiereLogin);

router.get('/', wrap(async (_req, res) => {
  res.json(await q(`SELECT e.*, TIME_FORMAT(e.hora,'%H:%i') AS hora_txt,
      (SELECT COUNT(*) FROM inscripciones_evento i WHERE i.evento_id = e.id) AS inscritos
      FROM eventos e ORDER BY e.fecha DESC, e.hora DESC LIMIT 200`));
}));

router.post('/imagen', requierePermiso('eventos.publicar'), subir.single('imagen'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Suba una imagen PNG, JPG o WEBP de máximo 3 MB' });
  res.json({ ruta: '/uploads/' + req.file.filename });
});

const CAMPOS = ['sede_id', 'titulo', 'tipo', 'descripcion', 'fecha', 'hora', 'lugar', 'imagen', 'modalidad',
  'url_transmision', 'requiere_inscripcion', 'estado', 'publicado'];

function datos(b) {
  const d = {};
  for (const c of CAMPOS) if (b[c] !== undefined) d[c] = (b[c] === '' ? null : b[c]);
  if (d.requiere_inscripcion !== undefined) d.requiere_inscripcion = d.requiere_inscripcion ? 1 : 0;
  if (d.publicado !== undefined) d.publicado = d.publicado ? 1 : 0;
  if (d.imagen && !/^\/uploads\/[a-f0-9]+\.(png|jpg|jpeg|webp)$/.test(d.imagen)) delete d.imagen;
  return d;
}

router.post('/', requierePermiso('eventos.publicar'), wrap(async (req, res) => {
  const d = datos(req.body || {});
  if (!d.titulo || !d.fecha || !d.hora) return res.status(400).json({ error: 'Título, fecha y hora son obligatorios' });
  if (!d.sede_id) d.sede_id = (await one('SELECT id FROM sedes WHERE es_local = 1 LIMIT 1')).id;
  d.publicado_por = req.user.id;
  const cols = Object.keys(d);
  const r = await q(`INSERT INTO eventos (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, cols.map(c => d[c]));
  await auditar(req, 'crear', 'eventos', r.insertId, d.titulo);
  res.status(201).json({ id: r.insertId });
}));

router.put('/:id', requierePermiso('eventos.publicar'), wrap(async (req, res) => {
  const d = datos(req.body || {});
  const ev = await one('SELECT id, fecha, estado FROM eventos WHERE id=?', [req.params.id]);
  if (!ev) return res.status(404).json({ error: 'Evento no encontrado' });
  // cambio de fecha => queda como reprogramado y se conserva la fecha original
  if (d.fecha && d.fecha !== ev.fecha && d.estado !== 'cancelado') {
    d.estado = 'reprogramado';
    await q('UPDATE eventos SET fecha_original = COALESCE(fecha_original, ?) WHERE id=?', [ev.fecha, ev.id]);
  }
  const cols = Object.keys(d);
  if (cols.length) await q(`UPDATE eventos SET ${cols.map(c => c + '=?').join(',')} WHERE id=?`, [...cols.map(c => d[c]), ev.id]);
  await auditar(req, 'editar', 'eventos', ev.id, d.estado || '');
  res.json({ ok: true });
}));

router.delete('/:id', requierePermiso('registros.eliminar'), wrap(async (req, res) => {
  await q('DELETE FROM eventos WHERE id=?', [req.params.id]);
  await auditar(req, 'eliminar', 'eventos', req.params.id, '');
  res.json({ ok: true });
}));

router.get('/:id/inscritos', requierePermiso('eventos.publicar'), wrap(async (req, res) => {
  res.json(await q('SELECT id, nombre, celular, correo, creado_en FROM inscripciones_evento WHERE evento_id=? ORDER BY id', [req.params.id]));
}));

module.exports = router;
