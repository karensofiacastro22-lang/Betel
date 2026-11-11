// Listas de opciones para los formularios: [valor, texto]
export const TIPOS_ID = [['CC', 'Cédula de ciudadanía'], ['TI', 'Tarjeta de identidad'], ['CE', 'Cédula de extranjería'],
  ['PPT', 'Permiso por protección temporal'], ['PAS', 'Pasaporte'], ['RC', 'Registro civil'], ['OTRO', 'Otro']];
export const SANGRE = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(x => [x, x]);
export const ESTADOS_DISCIPULO = [['activo', 'Activo'], ['inactivo', 'Inactivo'], ['retirado', 'Retirado']];
export const MODALIDADES = [['presencial', 'Presencial'], ['virtual', 'Virtual'], ['mixta', 'Presencial y virtual']];
export const MODALIDAD_TXT = Object.fromEntries(MODALIDADES);
export const ESTADOS_FORMACION = [['en_curso', 'En curso'], ['completado', 'Completado'], ['suspendido', 'Suspendido']];
export const ESTADOS_EVENTO = [['programado', 'Programado'], ['reprogramado', 'Reprogramado'], ['cancelado', 'Cancelado']];
export const MEDIOS_AUTORIZACION = [['papel', 'En papel'], ['digital', 'Digital'], ['ambos', 'Ambos']];
export const MARCAS_ASISTENCIA = [['presente', 'p', 'Presente'], ['ausente', 'a', 'Ausente'], ['justificado', 'j', 'Justificado']];
