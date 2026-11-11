require('dotenv').config({ override: true, quiet: true });   // el .env del proyecto manda sobre variables heredadas de la terminal
const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const { cargarUsuario } = require('./auth');
const { one } = require('./db');

const app = express();
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: { 'upgrade-insecure-requests': null, 'img-src': ["'self'", 'data:', 'blob:'] }
  }
}));
app.use(compression());                       // respuestas comprimidas (gzip): carga más rápida en celulares
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(cargarUsuario);

// ---------- Archivos estáticos ----------
const pub = path.join(__dirname, '..', 'public');   // imágenes del sitio y archivos subidos
const dist = path.join(__dirname, '..', 'dist');     // aplicación React compilada (npm run build)
const indexHtml = path.join(dist, 'index.html');

// Los archivos de /assets llevan un hash en el nombre: se pueden guardar en caché un año sin problema
app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }));
app.use('/img', express.static(path.join(pub, 'img'), { maxAge: '7d' }));
app.use('/uploads', express.static(path.join(pub, 'uploads'), { maxAge: '7d' }));   // imágenes antiguas en disco (si existen)
app.get('/uploads/:nombre', async (req, res, next) => {                             // imágenes guardadas en la base de datos
  try {
    const a = await one('SELECT tipo, datos FROM archivos WHERE nombre = ?', [req.params.nombre]);
    if (!a) return res.status(404).end();
    res.set('Cache-Control', 'public, max-age=31536000, immutable').type(a.tipo).send(a.datos);
  } catch (e) { next(e); }
});
app.use(express.static(dist, { index: false }));

// ---------- API ----------
app.use('/api/publico', require('./routes/publico'));
app.use('/api/asistir', require('./routes/asistir'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/discipulos', require('./routes/discipulos'));
app.use('/api/grupos', require('./routes/grupos'));
app.use('/api/eventos', require('./routes/eventos'));
app.use('/api/asistencia', require('./routes/asistencia'));
app.use('/api/reportes', require('./routes/reportes'));
app.use('/api', require('./routes/admin'));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// ---------- Aplicación React ----------
// Cualquier otra ruta (/, /sistema/..., /a/<código QR>) la resuelve React Router en el navegador.
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (!fs.existsSync(indexHtml))
    return res.status(503).type('text').send('Falta compilar la interfaz. Ejecute "npm run build" y vuelva a iniciar el servidor.');
  res.set('Cache-Control', 'no-cache');      // index.html siempre se revisa para tomar la última versión
  res.sendFile(indexHtml);
});

// manejador de errores
app.use((err, _req, res, _next) => {
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe un registro con esos datos (duplicado)' });
  if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: 'Referencia inválida a otro registro' });
  if (err.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ error: 'No se puede eliminar: tiene registros asociados' });
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  // En desarrollo se devuelve el detalle para poder diagnosticar; en producción (Vercel) no se expone.
  const detalle = process.env.NODE_ENV === 'production' ? undefined : `${err.code || ''} ${err.message || ''}`.trim();
  res.status(500).json({ error: 'Error interno del servidor', detalle });
});

// En Vercel la app se exporta y la ejecuta api/index.js; en el equipo local (npm start / npm run dev) se abre el puerto.
module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`BETEL en http://localhost:${PORT}  (sistema: /sistema)`);
    if (!fs.existsSync(indexHtml)) console.warn('Aviso: no existe dist/. Ejecute "npm run build" para compilar la interfaz React.');
  });
}
