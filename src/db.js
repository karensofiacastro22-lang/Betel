require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// SSL para bases en la nube (Aiven exige SSL). Se activa con DB_SSL=true.
// El certificado CA se toma de DB_SSL_CA (contenido, útil en hostings) o de DB_SSL_CA_PATH (archivo).
function configurarSSL() {
  if (String(process.env.DB_SSL).toLowerCase() !== 'true') return undefined;
  let ca = process.env.DB_SSL_CA;
  if (!ca && process.env.DB_SSL_CA_PATH) {
    ca = fs.readFileSync(path.resolve(__dirname, '..', process.env.DB_SSL_CA_PATH), 'utf8');
  }
  return ca ? { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true } : { rejectUnauthorized: true };
}

const pool = mysql.createPool({
  ssl: configurarSSL(),
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'betel',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,          // las fechas llegan como texto AAAA-MM-DD
  charset: 'utf8mb4'
});

const q = async (sql, params = []) => (await pool.query(sql, params))[0];
const one = async (sql, params = []) => (await q(sql, params))[0] || null;

module.exports = { pool, q, one };
