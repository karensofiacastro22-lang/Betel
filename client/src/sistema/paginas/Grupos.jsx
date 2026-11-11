import { useState } from 'react';
import { api, leerForm } from '../../lib/api.js';
import { useCarga } from '../../lib/hooks.js';
import { DIAS, fechaTxt } from '../../lib/formato.js';
import { Badge, Campo, Cargando, Vacio } from '../../components/ui.jsx';
import { PieForm, useModal } from '../../components/Modal.jsx';
import { useAviso } from '../../components/Avisos.jsx';
import { useSesion } from '../sesion.jsx';

export default function Grupos() {
  const { can } = useSesion();
  const modal = useModal();
  const carga = useCarga(() => api.get('/grupos'));

  return <Cargando carga={carga}>{gs => <>
    <div className="acciones-top">
      <span className="gris">{gs.length} grupo(s)</span>
      {can('grupos.gestionar') && <button className="btn" onClick={() => modal.abrir('Nuevo grupo', <FormGrupo recargar={carga.recargar} />)}>+ Nuevo grupo</button>}
    </div>
    {gs.some(g => g.estado === 'listo_nueva_iglesia') && (
      <div className="aviso">Hay grupos que alcanzaron su máximo de discípulos. El propósito es abrir una nueva iglesia con ese grupo.</div>
    )}
    <div className="grid g3">
      {gs.length ? gs.map(g => {
        const abrir = () => modal.abrir(g.nombre, <DetalleGrupo id={g.id} recargar={carga.recargar} />);
        return (
        <article key={g.id} role="button" tabIndex={0} className={'tarjeta grupo-card' + (g.estado === 'listo_nueva_iglesia' ? ' lleno' : '')}
          onClick={abrir} onKeyDown={e => { if (e.key === 'Enter') abrir(); }}>
          <h3>{g.nombre}</h3>
          <p className="gris">Discipulador: <b style={{ color: 'var(--texto)' }}>{g.discipulador || 'Sin asignar'}</b></p>
          <div className="progreso"><i style={{ width: `${Math.min(100, Math.round(g.integrantes / g.max_integrantes * 100))}%` }} /></div>
          <p>{g.integrantes} de {g.max_integrantes} discípulos <Badge estado={g.estado} /></p>
          <small className="gris">{[g.dia_reunion, g.hora_reunion?.slice(0, 5), g.lugar].filter(Boolean).join(' · ')}</small>
        </article>
        );
      }) : <Vacio panel>No hay grupos registrados.</Vacio>}
    </div>
  </>}</Cargando>;
}

function DetalleGrupo({ id, recargar }) {
  const { can } = useSesion();
  const modal = useModal();
  const aviso = useAviso();
  const gest = can('grupos.gestionar');
  const carga = useCarga(async () => {
    const [g, opciones] = await Promise.all([api.get('/grupos/' + id), gest ? api.get('/discipulos/opciones') : []]);
    return { g, opciones };
  }, [id]);
  const refrescar = () => { carga.recargar(); recargar(); };

  const agregar = async (e) => {
    e.preventDefault();
    try {
      const r = await api.post(`/grupos/${id}/discipulos`, { discipulo_id: leerForm(e.currentTarget).discipulo_id });
      aviso.ok(r.trasladado ? 'Discípulo trasladado a este grupo' : 'Discípulo agregado');
      if (r.lleno) aviso.ok('El grupo alcanzó su máximo: listo para nueva iglesia');
      refrescar();
    } catch (er) { aviso.error(er); }
  };
  const retirar = async (did) => {
    try { await api.del(`/grupos/${id}/discipulos/${did}`); refrescar(); } catch (er) { aviso.error(er); }
  };
  const eliminar = async () => {
    if (!window.confirm('¿Eliminar este grupo? Se pierde su historial de discípulos.')) return;
    try { await api.del('/grupos/' + id); modal.cerrar(); recargar(); } catch (er) { aviso.error(er); }
  };

  return <Cargando carga={carga}>{({ g, opciones }) => {
    const lleno = g.discipulos.length >= g.max_integrantes;
    const ya = new Set(g.discipulos.map(x => x.id));
    return <>
      <p><Badge estado={g.estado} /> · Discipulador: <b>{g.discipulador || 'Sin asignar'}</b> · {g.discipulos.length}/{g.max_integrantes} discípulos</p>
      {g.estado === 'listo_nueva_iglesia' && <div className="aviso">Este grupo alcanzó su máximo de discípulos: corresponde abrir una nueva iglesia con este grupo.</div>}
      <ul className="lista-simple">
        {g.discipulos.length ? g.discipulos.map(x => (
          <li key={x.id}>
            <span>{x.nombre}<br /><small>Desde {fechaTxt(x.fecha_ingreso)}</small></span>
            {gest && <button className="btn sec peq" onClick={() => retirar(x.id)}>Retirar</button>}
          </li>
        )) : <li>Sin discípulos.</li>}
      </ul>
      {gest && !lleno && (
        <form className="form" onSubmit={agregar} key={g.discipulos.length}>
          <div className="fila">
            <Campo label="Agregar discípulo" name="discipulo_id" req vacio="Seleccione un discípulo"
              opciones={opciones.filter(o => !ya.has(o.id)).map(o => [o.id, o.nombre])} />
          </div>
          <small>Si el discípulo estaba en otro grupo, se traslada a este.</small><br />
          <button className="btn sec peq" style={{ marginTop: 8 }}>Agregar</button>
        </form>
      )}
      <div className="m-pie">
        {can('registros.eliminar') && <button className="btn peligro" onClick={eliminar}>Eliminar grupo</button>}
        {gest && <button className="btn" onClick={() => modal.abrir('Editar grupo', <FormGrupo g={g} recargar={recargar} />)}>Editar grupo</button>}
      </div>
    </>;
  }}</Cargando>;
}

function FormGrupo({ g, recargar }) {
  const { esDiscipulador } = useSesion();
  const modal = useModal();
  const aviso = useAviso();
  const opciones = useCarga(() => (esDiscipulador ? Promise.resolve([]) : api.get('/discipulos/opciones')));
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const v = g || {};

  const guardar = async (e) => {
    e.preventDefault();
    const d = leerForm(e.currentTarget);
    setOcupado(true); setError('');
    try {
      if (g) await api.put('/grupos/' + g.id, d); else await api.post('/grupos', d);
      modal.cerrar(); aviso.ok('Grupo guardado'); recargar();
    } catch (er) { setError(er.message); setOcupado(false); }
  };

  return <Cargando carga={opciones}>{ops => (
    <form className="form" onSubmit={guardar}>
      <div className="fila">
        <Campo label="Nombre del grupo" name="nombre" valor={v.nombre} req max={100} />
        {!esDiscipulador && <Campo label="Discipulador" name="discipulador_id" valor={v.discipulador_id} opciones={ops.map(o => [o.id, o.nombre])} vacio="Sin asignar" />}
        <Campo label="Máximo de discípulos" name="max_integrantes" valor={v.max_integrantes || 12} tipo="number" min={2} />
        <Campo label="Día de reunión" name="dia_reunion" valor={v.dia_reunion} opciones={DIAS.map(d => [d, d])} vacio="Sin definir" />
        <Campo label="Hora" name="hora_reunion" valor={v.hora_reunion ? v.hora_reunion.slice(0, 5) : ''} tipo="time" />
        <Campo label="Lugar" name="lugar" valor={v.lugar} max={200} />
      </div>
      {esDiscipulador && <small>Usted quedará como discipulador de este grupo.</small>}
      <p className="err">{error}</p>
      <PieForm ocupado={ocupado} />
    </form>
  )}</Cargando>;
}
