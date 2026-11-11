import { api } from '../../lib/api.js';
import { useCarga } from '../../lib/hooks.js';
import { Cargando, Tabla } from '../../components/ui.jsx';

export default function Bitacora() {
  const carga = useCarga(() => api.get('/bitacora'));
  return <>
    <p className="gris">Últimas 200 acciones registradas en el sistema.</p>
    <Cargando carga={carga}>{r => (
      <Tabla columnas={['Fecha', 'Usuario', 'Acción', 'Elemento', 'Detalle']}>
        {r.map(b => (
          <tr key={b.id}>
            <td>{b.fecha}</td><td>{b.usuario || '—'}</td><td>{b.accion}</td>
            {/* los registros antiguos dicen "miembros"; se muestran como discípulos */}
            <td>{b.entidad === 'miembros' ? 'discipulos' : b.entidad} {b.entidad_id ? '#' + b.entidad_id : ''}</td>
            <td>{b.detalle || ''}</td>
          </tr>
        ))}
      </Tabla>
    )}</Cargando>
  </>;
}
