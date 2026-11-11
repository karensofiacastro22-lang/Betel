const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { q, one } = require('../db');
const A = require('../auth');

const limite = rateLimit({ windowMs: 15 * 60 * 1000, max: 15, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intente de nuevo en unos minutos.' } });

router.post('/login', limite, A.wrap(async (req, res) => {
  const { correo, password } = req.body || {};
  if (!correo || !password) return res.status(400).json({ error: 'Ingrese correo y contraseña' });
  const u = await one('SELECT id, password_hash, activo FROM usuarios WHERE correo = ?', [String(correo).trim().toLowerCase()]);
  if (!u || !u.activo || !(await bcrypt.compare(String(password), u.password_hash)))
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  await q('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = ?', [u.id]);
  A.poner(res, A.firmar(u));
  req.user = { id: u.id };
  await A.auditar(req, 'login', 'usuarios', u.id, '');
  res.json({ ok: true });
}));

router.post('/logout', (_req, res) => { res.clearCookie(A.COOKIE); res.json({ ok: true }); });

router.get('/me', A.requiereLogin, (req, res) => {
  const u = req.user;
  const permisos = Object.keys(A.PERMISOS).filter(p => A.can(u, p));
  res.json({ id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol, rol_nombre: u.rol_nombre, permisos });
});

router.post('/password', A.requiereLogin, A.wrap(async (req, res) => {
  const { actual, nueva } = req.body || {};
  if (!nueva || String(nueva).length < 8) return res.status(400).json({ error: 'La nueva contraseña debe tener mínimo 8 caracteres' });
  const u = await one('SELECT password_hash FROM usuarios WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(String(actual || ''), u.password_hash))) return res.status(400).json({ error: 'La contraseña actual no es correcta' });
  await q('UPDATE usuarios SET password_hash = ? WHERE id = ?', [await bcrypt.hash(String(nueva), 10), req.user.id]);
  await A.auditar(req, 'cambio_password', 'usuarios', req.user.id, '');
  res.json({ ok: true });
}));

module.exports = router;
