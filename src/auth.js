const jwt = require('jsonwebtoken');
const { q, one } = require('./db');

const SECRET = process.env.JWT_SECRET || 'dev-secret-cambiar';
const COOKIE = 'betel_token';

// Permisos por rol, según las respuestas de la reunión con el equipo administrador
const TODOS = ['administrador', 'pastor'];
const PERMISOS = {
  'discipulos.ver':         [...TODOS, 'asistencia_pastoral', 'discipulador', 'multimedia'],
  'discipulos.sensibles':   [...TODOS, 'asistencia_pastoral', 'discipulador'],
  'discipulos.confidencial':[...TODOS],
  'discipulos.editar':      [...TODOS, 'asistencia_pastoral'],
  'discipulos.estado':      [...TODOS, 'asistencia_pastoral'],
  'registros.eliminar':   [...TODOS, 'asistencia_pastoral', 'multimedia'],
  'grupos.gestionar':     [...TODOS, 'asistencia_pastoral', 'discipulador'],
  'eventos.publicar':     [...TODOS, 'multimedia'],
  'asistencia.registrar': [...TODOS, 'asistencia_pastoral', 'discipulador', 'multimedia'],
  'asistencia.corregir':  [...TODOS, 'asistencia_pastoral'],
  'alertas.ver':          [...TODOS, 'asistencia_pastoral'],
  'estadisticas.ver':     [...TODOS, 'asistencia_pastoral', 'multimedia'],
  'reportes.ver':         [...TODOS, 'asistencia_pastoral', 'multimedia', 'discipulador'],
  'reportes.cumpleanos':  [...TODOS, 'asistencia_pastoral', 'multimedia'],
  'admin.sistema':        [...TODOS]
};

const can = (user, permiso) => !!user && (PERMISOS[permiso] || []).includes(user.rol);

function firmar(u) {
  return jwt.sign({ id: u.id }, SECRET, { expiresIn: '8h' });
}
function poner(res, token) {
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', maxAge: 8 * 3600 * 1000,
    secure: process.env.COOKIE_SECURE === 'true' });
}

async function cargarUsuario(req, _res, next) {
  try {
    const t = req.cookies && req.cookies[COOKIE];
    if (t) {
      const { id } = jwt.verify(t, SECRET);
      const u = await one(
        `SELECT u.id, u.nombre, u.correo, u.miembro_id, u.activo, r.codigo AS rol, r.nombre AS rol_nombre
           FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = ?`, [id]);
      if (u && u.activo) req.user = u;
    }
  } catch (_) { /* token inválido: se ignora */ }
  next();
}

const requiereLogin = (req, res, next) =>
  req.user ? next() : res.status(401).json({ error: 'Debe iniciar sesión' });

const requierePermiso = (permiso) => (req, res, next) =>
  can(req.user, permiso) ? next() : res.status(403).json({ error: 'No tiene permiso para esta acción' });

// Grupos que un usuario puede ver. null = todos. Para discipuladores: solo los que tiene a cargo.
// (user.miembro_id es el discípulo vinculado al usuario; la columna conserva su nombre en la base de datos)
async function gruposPermitidos(user) {
  if (user.rol !== 'discipulador') return null;
  if (!user.miembro_id) return [];
  const r = await q('SELECT id FROM grupos_comunion WHERE discipulador_id = ?', [user.miembro_id]);
  return r.map(x => x.id);
}

async function auditar(req, accion, entidad, entidad_id, detalle) {
  try {
    await q('INSERT INTO bitacora (usuario_id, accion, entidad, entidad_id, detalle, ip) VALUES (?,?,?,?,?,?)',
      [req.user ? req.user.id : null, accion, entidad, entidad_id || null, (detalle || '').slice(0, 500), req.ip]);
  } catch (_) {}
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { can, firmar, poner, COOKIE, cargarUsuario, requiereLogin, requierePermiso,
  gruposPermitidos, auditar, wrap, PERMISOS };
