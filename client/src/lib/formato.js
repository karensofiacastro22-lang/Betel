export const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');

/** Fecha de hoy en formato AAAA-MM-DD (hora local). */
export const hoy = () => new Date().toLocaleDateString('en-CA');

/** "2026-03-05" -> "5 de marzo de 2026" */
export function fechaTxt(f) {
  if (!f) return '';
  const [y, m, d] = String(f).slice(0, 10).split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

/** "2026-03-05" -> "5 mar 2026" */
export function fechaCorta(f) {
  const [y, m, d] = String(f).slice(0, 10).split('-').map(Number);
  return `${d} ${MESES_CORTOS[m - 1]} ${y}`;
}

/** "2026-03-05" -> "jueves, 5 de marzo" */
export function fechaLarga(f) {
  const [y, m, d] = String(f).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "19:30" -> "7:30 p. m." */
export function hora12(h) {
  if (!h) return '';
  const [H, M] = String(h).split(':').map(Number);
  return `${((H + 11) % 12) + 1}:${String(M).padStart(2, '0')} ${H < 12 ? 'a. m.' : 'p. m.'}`;
}

export const estadoTxt = (e) =>
  ({ listo_nueva_iglesia: 'Listo para nueva iglesia', en_curso: 'En curso' }[e] || capital(e || ''));
