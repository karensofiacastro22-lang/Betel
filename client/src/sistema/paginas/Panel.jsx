import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useCarga } from '../../lib/hooks.js';
import { MESES, fechaTxt } from '../../lib/formato.js';
import { Badge, Cargando, Vacio } from '../../components/ui.jsx';

export default function Panel() {
  const carga = useCarga(() => api.get('/dashboard'));
  return <Cargando carga={carga}>{d => <>
    <div className="grid g4">
      {d.discipulos && <>
        <div className="stat"><b>{d.discipulos.activos || 0}</b><span>Discípulos activos (de {d.discipulos.total})</span></div>
        <div className="stat negro"><b>{d.grupos.total}</b><span>Grupos de comunión</span></div>
      </>}
      {d.grupos?.llenos > 0 && (
        <div className="stat ambar"><Link to="/sistema/grupos"><b>{d.grupos.llenos}</b><span>Grupos listos para nueva iglesia</span></Link></div>
      )}
      {d.alertas_pendientes !== undefined && (
        <div className="stat rojo"><Link to="/sistema/alertas"><b>{d.alertas_pendientes}</b><span>Alertas de inasistencia pendientes</span></Link></div>
      )}
    </div>

    <div className="grid g2 mt">
      {d.asistencia && <GraficoAsistencia filas={d.asistencia} />}
      {d.cumpleanos && (
        <div className="panel"><h3>Cumpleaños de {MESES[new Date().getMonth()]}</h3>
          {d.cumpleanos.length
            ? <ul className="lista-simple">{d.cumpleanos.map(c => <li key={c.id}><span>{c.nombre}</span><b>{c.dia}</b></li>)}</ul>
            : <Vacio>Sin cumpleaños este mes.</Vacio>}
        </div>
      )}
      <div className="panel"><h3>Próximos eventos</h3>
        {d.proximos_eventos.length
          ? <ul className="lista-simple">{d.proximos_eventos.map(e => (
            <li key={e.id}><span>{e.titulo}<br /><small>{fechaTxt(e.fecha)} · {e.hora}</small></span><Badge estado={e.estado} /></li>
          ))}</ul>
          : <Vacio>No hay eventos próximos.</Vacio>}
      </div>
    </div>
  </>}</Cargando>;
}

function GraficoAsistencia({ filas }) {
  const total = (a) => Number(a.presentes) + Number(a.visitantes);
  const max = Math.max(1, ...filas.map(total));
  return (
    <div className="panel"><h3>Asistencia a cultos y reuniones (últimas 8)</h3>
      {filas.length
        ? <div className="barras">{filas.map(a => (
          <div className="barra-col" key={a.id} title={a.nombre}>
            <strong>{total(a)}</strong>
            <div className="b" style={{ height: `${Math.round(total(a) / max * 100)}%` }} />
            {a.fecha.slice(5)}
          </div>
        ))}</div>
        : <Vacio>Aún no hay asistencia registrada.</Vacio>}
    </div>
  );
}
