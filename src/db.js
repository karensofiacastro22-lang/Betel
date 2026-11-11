require('dotenv').config({ override: true, quiet: true });   // el .env del proyecto manda sobre variables heredadas de la terminal
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
  connectionLimit: process.env.VERCEL ? 3 : 10,   // en Vercel cada función abre pocas conexiones (Aiven tiene un límite)
  maxIdle: process.env.VERCEL ? 1 : 3,            // conexiones inactivas que se conservan
  idleTimeout: 60000,                             // las inactivas se cierran al minuto (evita conexiones "muertas")
  enableKeepAlive: true,                          // mantiene viva la conexión TCP/SSL con Aiven
  keepAliveInitialDelay: 10000,
  connectTimeout: 15000,
  dateStrings: true,          // las fechas llegan como texto AAAA-MM-DD
  charset: 'utf8mb4'
});

// Una conexión puede morir mientras está inactiva (cambio de red, función de Vercel congelada, corte de Aiven).
// mysql2 a veces la sigue entregando y TODAS las consultas fallan ("connection is in closed state").
// Por eso, si la conexión está muerta, se descarta y se reintenta con una nueva.
const MUERTA = new Set(['PROTOCOL_CONNECTION_LOST', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'ECONNREFUSED',
  'ER_CON_COUNT_ERROR', 'PROTOCOL_SEQUENCE_TIMEOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ERR_STREAM_DESTROYED']);
const conexionMuerta = (e) => Boolean(e && (e.fatal || MUERTA.has(e.code) || /closed state|connection.*(closed|lost)/i.test(e.message || '')));

const q = async (sql, params = []) => {
  for (let intento = 1; ; intento++) {
    let conn;
    try {
      conn = await pool.getConnection();
      const [filas] = await conn.query(sql, params);
      conn.release();
      return filas;
    } catch (e) {
      if (conn) { if (conexionMuerta(e)) conn.destroy(); else conn.release(); }
      if (!conexionMuerta(e) || intento >= 3) throw e;
      console.warn(`[db] conexión perdida (${e.code || e.message}); reintentando ${intento}/2…`);
      await new Promise(r => setTimeout(r, 200 * intento));
    }
  }
};
const one = async (sql, params = []) => (await q(sql, params))[0] || null;

module.exports = { pool, q, one };
