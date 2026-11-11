// Marcación pública de asistencia: el discípulo escanea el QR de la eucaristía/reunión del día
// y escribe su número de identificación. No requiere iniciar sesión.
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { q, one } = require('../db');
const { wrap } = require('../auth');
const { evaluarAlertas } = require('./asistencia');

// Hay muchas personas detrás de la misma red (wifi de la iglesia / datos móviles), por eso el límite es holgado.
const limitador = rateLimit({ windowMs: 5 * 60 * 1000, max: 150, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espere unos minutos e intente de nuevo.' } });
router.use(limitador);

const TOKEN = /^[a-f0-9]{32}$/;
const hoyColombia = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const limpiarDoc = (v) => String(v || '').replace(/[^0-9A-Za-z]/g, '').slice(0, 30);
// Nombres: solo letras, espacios, apóstrofes y guiones; espacios repetidos se reducen a uno
const limpiarNombre = (v) => String(v || '').replace(/[^\p{L}\s'-]/gu, '').trim().replace(/\s+/g, ' ').slice(0, 100);

async function cargar(token) {
  if (!TOKEN.test(token || '')) return null;
  return one('SELECT id, tipo, nombre, fecha, sede_id, horario_id, evento_id, grupo_id FROM sesiones_asistencia WHERE token_qr = ?', [token]);
}
// Un código solo sirve el día de su lista: así cada día (y cada eucaristía) tiene su propio código.
const estadoDia = (s) => {
  const h = hoyColombia();
  return s.fecha === h ? 'hoy' : (s.fecha > h ? 'futuro' : 'vencido');
};

router.get('/:token', wrap(async (req, res) => {
  const s = await cargar(req.params.token);
  if (!s) return res.status(404).json({ error: 'Este código QR no es válido o fue reemplazado. Pida el código actualizado en la entrada.' });
  const dia = estadoDia(s);
  res.json({ nombre: s.nombre, fecha: s.fecha, abierta: dia === 'hoy', dia });
}));

router.post('/:token', wrap(async (req, res) => {
  const s = await cargar(req.params.token);
  if (!s) return res.status(404).json({ error: 'Este código QR no es válido o fue reemplazado. Pida el código actualizado en la entrada.' });
  const dia = estadoDia(s);
  if (dia !== 'hoy') return res.status(409).json({ error: dia === 'futuro' ? `Este código es para el ${s.fecha}; todavía no está habilitado.` : `Este código era para el ${s.fecha} y ya no está habilitado.` });

  const { numero_identificacion, visitante_nombre, nombres, apellidos } = req.body || {};

  // --- Visitante (sin registro como discípulo) ---
  if (!numero_identificacion) {
    const nombre = String(visitante_nombre || '').trim().replace(/\s+/g, ' ').slice(0, 150);
    if (nombre.length < 3) return res.status(400).json({ error: 'Escriba su número de identificación o, si es visitante, su nombre completo.' });
    const ya = await one("SELECT id FROM asistencias WHERE sesion_id=? AND miembro_id IS NULL AND LOWER(visitante_nombre)=LOWER(?)", [s.id, nombre]);
    if (!ya) await q("INSERT INTO asistencias (sesion_id, visitante_nombre, estado, origen) VALUES (?,?, 'visitante', 'qr')", [s.id, nombre]);
    const primerV = nombre.split(' ')[0];
    return res.json({ ok: true, repetido: !!ya, mensaje: ya
      ? `${primerV}, su visita a ${s.nombre} ya estaba registrada.`
      : `¡Bienvenido(a), ${primerV}! Registramos su visita en ${s.nombre}.` });
  }

  // --- Discípulo ---
  const doc = limpiarDoc(numero_identificacion);
  if (doc.length < 4) return res.status(400).json({ error: 'Escriba su número de identificación completo, sin puntos ni espacios.' });
  // Se busca en todos los discípulos (cualquier estado) comparando sin puntos, guiones ni espacios,
  // por si el documento se guardó con formato. Así una persona ya registrada nunca se duplica.
  const hallados = await q(`SELECT id, nombres FROM miembros
      WHERE REPLACE(REPLACE(REPLACE(numero_identificacion,'.',''),'-',''),' ','') = ? LIMIT 2`, [doc]);
  if (hallados.length > 1) return res.status(409).json({ error: 'Ese número está asociado a más de una persona. Pida a Asistencia Pastoral que registre su asistencia.' });
  let m = hallados[0];
  let nuevo = false;

  if (!m) {
    // No está registrado: si todavía no envió sus datos, se le piden (nombres y apellidos)
    const nom = limpiarNombre(nombres), ape = limpiarNombre(apellidos);
    if (!nombres && !apellidos)
      return res.status(404).json({ registrar: true, error: 'Su cédula no está registrada. Complete sus datos para registrarse como discípulo, o elija "Solo soy visitante".' });
    if (nom.length < 2 || ape.length < 2)
      return res.status(400).json({ registrar: true, error: 'Escriba sus nombres y apellidos completos.' });
    // Se registra como discípulo activo de la sede de esta reunión. Celular y cumpleaños los completa luego el equipo.
    const r = await q("INSERT INTO miembros (nombres, apellidos, tipo_identificacion, numero_identificacion, sede_id, estado) VALUES (?,?, 'CC', ?, ?, 'activo')",
      [nom, ape, doc, s.sede_id]);
    m = { id: r.insertId, nombres: nom };
    nuevo = true;
    await q("INSERT INTO bitacora (usuario_id, accion, entidad, entidad_id, detalle, ip) VALUES (NULL, 'registro_qr', 'miembros', ?, ?, ?)",
      [m.id, `${nom} ${ape} (CC ${doc}) se registró con el QR de ${s.nombre} ${s.fecha}`, req.ip]);
  }

  if (s.tipo === 'grupo') {
    const g = await one('SELECT 1 AS ok FROM grupo_miembro WHERE grupo_id=? AND miembro_id=? AND fecha_salida IS NULL', [s.grupo_id, m.id]);
    if (!g) return res.status(403).json({ error: nuevo
      ? 'Quedó registrado(a) como discípulo, pero esta lista es de un grupo de comunión: pida a su discipulador que lo agregue al grupo.'
      : 'Esta lista es de un grupo de comunión del que usted no hace parte.' });
  }

  const previo = await one('SELECT id, estado FROM asistencias WHERE sesion_id=? AND miembro_id=?', [s.id, m.id]);
  const primer = m.nombres.split(' ')[0];
  if (previo && previo.estado === 'presente') return res.json({ ok: true, repetido: true, mensaje: `${primer}, su asistencia a ${s.nombre} ya estaba registrada.` });
  if (previo && previo.estado === 'justificado') return res.status(409).json({ error: 'Su inasistencia ya fue justificada por el equipo. Hable con Asistencia Pastoral si hubo un error.' });

  if (previo) await q("UPDATE asistencias SET estado='presente', origen='qr' WHERE id=?", [previo.id]);   // estaba marcado ausente y llegó
  else await q("INSERT INTO asistencias (sesion_id, miembro_id, estado, origen) VALUES (?,?, 'presente', 'qr')", [s.id, m.id]);
  await evaluarAlertas(s, [m.id]);
  res.json({ ok: true, nuevo, mensaje: nuevo
    ? `¡Bienvenido(a), ${primer}! Quedó registrado(a) como discípulo y su asistencia a ${s.nombre} quedó registrada.`
    : `¡Bienvenido(a), ${primer}! Su asistencia a ${s.nombre} quedó registrada.` });
}));

module.exports = router;
