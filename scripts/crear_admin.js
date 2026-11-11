// Uso:  npm run crear-admin -- "Nombre" correo@ejemplo.com ContraseñaSegura123
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { q, one, pool } = require('../src/db');

(async () => {
  const [nombre, correo, clave] = process.argv.slice(2);
  if (!nombre || !correo || !clave || clave.length < 8) {
    console.log('Uso: npm run crear-admin -- "Nombre completo" correo@ejemplo.com Contraseña(min. 8 caracteres)');
    process.exit(1);
  }
  const rol = await one("SELECT id FROM roles WHERE codigo='administrador'");
  const hash = await bcrypt.hash(clave, 10);
  const ya = await one('SELECT id FROM usuarios WHERE correo=?', [correo.toLowerCase()]);
  if (ya) { await q('UPDATE usuarios SET password_hash=?, rol_id=?, activo=1 WHERE id=?', [hash, rol.id, ya.id]); console.log('Administrador actualizado.'); }
  else { await q('INSERT INTO usuarios (nombre, correo, password_hash, rol_id) VALUES (?,?,?,?)', [nombre, correo.toLowerCase(), hash, rol.id]); console.log('Administrador creado.'); }
  await pool.end();
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
