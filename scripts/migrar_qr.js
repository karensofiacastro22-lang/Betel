// Actualiza una base de datos BETEL YA EXISTENTE para soportar los códigos QR de asistencia.
// Es seguro ejecutarlo varias veces:  npm run migrar-qr
require('dotenv').config({ override: true, quiet: true });   // el .env del proyecto manda sobre variables heredadas de la terminal
const { pool } = require('../src/db');

async function existeColumna(tabla, columna) {
  const [r] = await pool.query(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [tabla, columna]);
  return r.length > 0;
}
async function existeIndice(tabla, indice) {
  const [r] = await pool.query(
    'SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?', [tabla, indice]);
  return r.length > 0;
}

(async () => {
  try {
    if (!(await existeColumna('sesiones_asistencia', 'token_qr'))) {
      await pool.query('ALTER TABLE sesiones_asistencia ADD COLUMN token_qr VARCHAR(48) NULL');
      console.log('+ sesiones_asistencia.token_qr');
    }
    if (!(await existeIndice('sesiones_asistencia', 'uq_ses_token'))) {
      await pool.query('ALTER TABLE sesiones_asistencia ADD UNIQUE KEY uq_ses_token (token_qr)');
      console.log('+ índice único uq_ses_token');
    }
    if (!(await existeColumna('asistencias', 'origen'))) {
      await pool.query("ALTER TABLE asistencias ADD COLUMN origen ENUM('manual','qr') NOT NULL DEFAULT 'manual'");
      console.log('+ asistencias.origen');
    }
    console.log('Listo. Los códigos de las listas ya existentes se generan solos la primera vez que se abre su QR.');
  } catch (e) {
    console.error('Error en la migración:', e.message); process.exitCode = 1;
  } finally { await pool.end(); }
})();
