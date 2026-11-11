import { api } from '../../lib/api.js';
import { useCarga } from '../../lib/hooks.js';
import { Cargando } from '../../components/ui.jsx';
import { useSesion } from '../sesion.jsx';

export default function Jerarquia() {
  const { cat } = useSesion();
  const carga = useCarga(() => api.get('/jerarquia'));
  return <Cargando carga={carga}>{r => {
    const nombres = new Map(r.map(x => [x.id, x.nombre]));
    return <>
      <p className="gris">Estructura pastoral actual. Cada nivel supervisa al siguiente en el mismo orden. La cobertura de cada persona se asigna en su ficha de discípulo.</p>
      <div className="arbol">
        {cat.niveles.map(n => {
          const g = r.filter(x => x.orden === n.orden);
          return (
            <div className="nivel" key={n.id}>
              <h4>{n.orden}. {n.nombre}</h4>
              {g.length ? g.map(x => (
                <span className="chip" key={x.id}>
                  <b>{x.nombre}</b>
                  <small>{x.supervisor_id ? 'Cobertura: ' + (nombres.get(x.supervisor_id) || 'Otro discípulo') : 'Sin supervisor asignado'}</small>
                </span>
              )) : <small className="gris">Sin personas asignadas a este nivel.</small>}
            </div>
          );
        })}
      </div>
    </>;
  }}</Cargando>;
}
