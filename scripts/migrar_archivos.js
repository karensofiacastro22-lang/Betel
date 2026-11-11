// Crea la tabla "archivos" (imágenes de eventos guardadas en la base de datos).
// Uso: npm run migrar-archivos   (se puede ejecutar varias veces sin problema)
const { q, pool } = require('../src/db');

(async () => {
  await q(`CREATE TABLE IF NOT EXISTS archivos (
    nombre    VARCHAR(40) PRIMARY KEY,
    tipo      VARCHAR(40) NOT NULL,
    datos     MEDIUMBLOB NOT NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  console.log('Tabla "archivos" lista en', process.env.DB_HOST);
  await pool.end();
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
