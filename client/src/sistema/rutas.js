import { lazy } from 'react';

// Menú y páginas del sistema. `p` = permiso necesario para ver la página.
// Cada página se descarga solo la primera vez que se abre.
export const RUTAS = [
  { path: '', t: 'Panel', C: lazy(() => import('./paginas/Panel.jsx')) },
  { path: 'discipulos', t: 'Discípulos', p: 'discipulos.ver', C: lazy(() => import('./paginas/Discipulos.jsx')) },
  { path: 'grupos', t: 'Grupos de comunión', C: lazy(() => import('./paginas/Grupos.jsx')) },
  { path: 'asistencia', t: 'Asistencia', p: 'asistencia.registrar', C: lazy(() => import('./paginas/Asistencia.jsx')) },
  { path: 'alertas', t: 'Alertas de inasistencia', p: 'alertas.ver', C: lazy(() => import('./paginas/Alertas.jsx')) },
  { path: 'eventos', t: 'Eventos y cultos', C: lazy(() => import('./paginas/Eventos.jsx')) },
  { path: 'reportes', t: 'Reportes', p: 'reportes.ver', C: lazy(() => import('./paginas/Reportes.jsx')) },
  { sep: 'Administración' },
  { path: 'jerarquia', t: 'Jerarquía pastoral', p: 'discipulos.sensibles', C: lazy(() => import('./paginas/Jerarquia.jsx')) },
  { path: 'config', t: 'Sedes y horarios', p: 'admin.sistema', C: lazy(() => import('./paginas/Config.jsx')) },
  { path: 'usuarios', t: 'Usuarios', p: 'admin.sistema', C: lazy(() => import('./paginas/Usuarios.jsx')) },
  { path: 'bitacora', t: 'Bitácora', p: 'admin.sistema', C: lazy(() => import('./paginas/Bitacora.jsx')) },
  { path: 'cuenta', t: 'Mi cuenta', C: lazy(() => import('./paginas/Cuenta.jsx')) }
];

export const ruta = (path) => '/sistema' + (path ? '/' + path : '');
