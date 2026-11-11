// Permite registrar discípulos desde el QR solo con nombres, apellidos y cédula:
// celular y fecha de cumpleaños pasan a ser opcionales en la base (el equipo los completa después).
// Uso: npm run migrar-registro-qr   (se puede ejecutar varias veces sin problema)
const { q, pool } = require('../src/db');

(async () => {
  await q('ALTER TABLE miembros MODIFY celular VARCHAR(25) NULL, MODIFY fecha_nacimiento DATE NULL');
  const cols = await q(`SELECT COLUMN_NAME c, IS_NULLABLE n FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'miembros' AND COLUMN_NAME IN ('celular','fecha_nacimiento')`);
  console.log('Migración aplicada en', process.env.DB_HOST, cols.map(x => `${x.c}: NULL=${x.n}`).join(', '));
  await pool.end();
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
