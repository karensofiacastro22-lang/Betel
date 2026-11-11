import { useState } from 'react';
import { api, leerForm } from '../../lib/api.js';
import { useCarga } from '../../lib/hooks.js';
import { DIAS } from '../../lib/formato.js';
import { MODALIDADES } from '../../lib/constantes.js';
import { Badge, Campo, Cargando, Check, Tabla, Tabs } from '../../components/ui.jsx';
import { PieForm, useModal } from '../../components/Modal.jsx';
import { useAviso } from '../../components/Avisos.jsx';
import { useSesion } from '../sesion.jsx';

export default function Config() {
  const [tab, setTab] = useState('sedes');
  return <>
    <Tabs opciones={[['sedes', 'Sedes'], ['horarios', 'Horarios de cultos'], ['ministerios', 'Ministerios']]} actual={tab} onCambio={setTab} />
    {tab === 'sedes' && <Sedes />}
    {tab === 'horarios' && <Horarios />}
    {tab === 'ministerios' && <Ministerios />}
  </>;
}

// ---------- Sedes ----------
function Sedes() {
  const modal = useModal();
  const carga = useCarga(() => api.get('/sedes'));
  const form = (s) => modal.abrir(s ? 'Editar sede' : 'Nueva sede', <FormSede s={s} recargar={carga.recargar} />);
  return <Cargando carga={carga}>{ss => <>
    <div className="acciones-top">
      <span className="gris">La información de las sedes se muestra en el sitio web.</span>
      <button className="btn" onClick={() => form(null)}>+ Nueva sede</button>
    </div>
    <Tabla columnas={['Sede', 'País', 'Ciudad', 'Dirección', '']}>
      {ss.map(s => (
        <tr key={s.id}>
          <td><b>{s.nombre}</b> {!!s.es_principal && <Badge estado="listo_nueva_iglesia">Principal</Badge>} {!!s.es_local && <Badge estado="activo">Local</Badge>}</td>
          <td>{s.pais}</td><td>{s.ciudad || '—'}</td><td>{s.direccion || '—'}</td>
          <td><button className="btn sec peq" onClick={() => form(s)}>Editar</button></td>
        </tr>
      ))}
    </Tabla>
  </>}</Cargando>;
}

function FormSede({ s, recargar }) {
  const { recargarCatalogos } = useSesion();
  const modal = useModal();
  const aviso = useAviso();
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const v = s || {};

  const guardar = async (e) => {
    e.preventDefault();
    const d = leerForm(e.currentTarget);
    setOcupado(true); setError('');
    try {
      if (s) await api.put('/sedes/' + s.id, d); else await api.post('/sedes', d);
      modal.cerrar(); aviso.ok('Sede guardada'); recargarCatalogos().catch(() => {}); recargar();
    } catch (er) { setError(er.message); setOcupado(false); }
  };
  const eliminar = async () => {
    if (!window.confirm('¿Eliminar esta sede?')) return;
    try { await api.del('/sedes/' + s.id); modal.cerrar(); recargarCatalogos().catch(() => {}); recargar(); } catch (er) { setError(er.message); }
  };

  return (
    <form className="form" onSubmit={guardar}>
      <div className="fila">
        <Campo label="Nombre" name="nombre" valor={v.nombre} req max={120} />
        <Campo label="País" name="pais" valor={v.pais} req max={80} />
        <Campo label="Ciudad" name="ciudad" valor={v.ciudad} max={80} />
        <Campo label="Dirección" name="direccion" valor={v.direccion} max={200} />
        <Campo label="Teléfono" name="telefono" valor={v.telefono} max={30} />
        <Campo label="Correo" name="correo" valor={v.correo} tipo="email" max={120} />
        <Campo label="Descripción breve" name="descripcion" valor={v.descripcion} area={3} max={500} full />
      </div>
      <Check label="Es la sede principal de la misión" name="es_principal" valor={v.es_principal} />
      <Check label="Visible en el sitio web" name="activa" valor={s ? v.activa : true} />
      <p className="err">{error}</p>
      <PieForm ocupado={ocupado}>
        {s && !s.es_local && <button type="button" className="btn peligro" onClick={eliminar}>Eliminar</button>}
      </PieForm>
    </form>
  );
}

// ---------- Horarios ----------
function Horarios() {
  const modal = useModal();
  const carga = useCarga(() => api.get('/horarios'));
  const form = (h) => modal.abrir(h ? 'Editar horario' : 'Nuevo horario', <FormHorario h={h} recargar={carga.recargar} />);
  return <Cargando carga={carga}>{hs => <>
    <div className="acciones-top">
      <span className="gris">Horarios de la sede local (Villavicencio).</span>
      <button className="btn" onClick={() => form(null)}>+ Nuevo horario</button>
    </div>
    <Tabla columnas={['Nombre', 'Día', 'Hora', 'Modalidad', 'Plataforma', 'Activo', '']}>
      {hs.map(h => (
        <tr key={h.id}>
          <td><b>{h.nombre}</b></td><td>{DIAS[h.dia_semana]}</td><td>{h.hora}</td><td>{h.modalidad}</td>
          <td>{h.plataforma || '—'}</td><td>{h.activo ? 'Sí' : 'No'}</td>
          <td><button className="btn sec peq" onClick={() => form(h)}>Editar</button></td>
        </tr>
      ))}
    </Tabla>
  </>}</Cargando>;
}

function FormHorario({ h, recargar }) {
  const modal = useModal();
  const aviso = useAviso();
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const v = h || {};

  const guardar = async (e) => {
    e.preventDefault();
    const d = leerForm(e.currentTarget); d.dia_semana = Number(d.dia_semana);
    setOcupado(true); setError('');
    try {
      if (h) await api.put('/horarios/' + h.id, d); else await api.post('/horarios', d);
      modal.cerrar(); aviso.ok('Horario guardado'); recargar();
    } catch (er) { setError(er.message); setOcupado(false); }
  };
  const eliminar = async () => {
    if (!window.confirm('¿Eliminar este horario?')) return;
    try { await api.del('/horarios/' + h.id); modal.cerrar(); recargar(); } catch (er) { setError(er.message); }
  };

  return (
    <form className="form" onSubmit={guardar}>
      <div className="fila">
        <Campo label="Nombre" name="nombre" valor={v.nombre} req max={100} />
        <Campo label="Día" name="dia_semana" valor={v.dia_semana ?? 0} req opciones={DIAS.map((d, i) => [i, d])} />
        <Campo label="Hora" name="hora" valor={v.hora} tipo="time" req />
        <Campo label="Modalidad" name="modalidad" valor={v.modalidad || 'presencial'} opciones={MODALIDADES} />
        <Campo label="Plataforma (Zoom, YouTube…)" name="plataforma" valor={v.plataforma} max={100} />
      </div>
      <Check label="Activo" name="activo" valor={h ? v.activo : true} />
      <p className="err">{error}</p>
      <PieForm ocupado={ocupado}>
        {h && <button type="button" className="btn peligro" onClick={eliminar}>Eliminar</button>}
      </PieForm>
    </form>
  );
}

// ---------- Ministerios ----------
function Ministerios() {
  const { cat, recargarCatalogos } = useSesion();
  const aviso = useAviso();
  const [ocupado, setOcupado] = useState(false);
  const ms = cat.ministerios;

  const agregar = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    setOcupado(true);
    try { await api.post('/ministerios', leerForm(form)); form.reset(); await recargarCatalogos(); } catch (er) { aviso.error(er); }
    finally { setOcupado(false); }
  };
  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar este ministerio? Se quitará de los discípulos que lo tengan.')) return;
    try { await api.del('/ministerios/' + id); await recargarCatalogos(); } catch (er) { aviso.error(er); }
  };

  return (
    <div className="panel">
      <ul className="lista-simple">
        {ms.length ? ms.map(x => (
          <li key={x.id}><span>{x.nombre}</span><button className="btn peligro peq" onClick={() => eliminar(x.id)}>Eliminar</button></li>
        )) : <li>Sin ministerios.</li>}
      </ul>
      <form className="form filtros" style={{ marginTop: 12 }} onSubmit={agregar}>
        <input name="nombre" placeholder="Nombre del nuevo ministerio" required maxLength={100} aria-label="Nombre del ministerio" />
        <button className="btn" disabled={ocupado}>Agregar</button>
      </form>
    </div>
  );
}
