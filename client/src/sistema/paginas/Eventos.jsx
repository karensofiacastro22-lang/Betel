import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, leerForm, subirArchivo } from '../../lib/api.js';
import { useCarga } from '../../lib/hooks.js';
import { DIAS } from '../../lib/formato.js';
import { ESTADOS_EVENTO, MODALIDADES } from '../../lib/constantes.js';
import { Badge, Campo, Cargando, Check, Tabla, Vacio } from '../../components/ui.jsx';
import { PieForm, useModal } from '../../components/Modal.jsx';
import { useAviso } from '../../components/Avisos.jsx';
import { useSesion } from '../sesion.jsx';

export default function Eventos() {
  const { can } = useSesion();
  const modal = useModal();
  const pub = can('eventos.publicar');
  const carga = useCarga(async () => {
    const [evs, hs] = await Promise.all([api.get('/eventos'), api.get('/horarios')]);
    return { evs, hs };
  });
  const form = (e) => modal.abrir(e ? 'Editar evento' : 'Nuevo evento', <FormEvento e={e} recargar={carga.recargar} />);

  return <Cargando carga={carga}>{({ evs, hs }) => <>
    <div className="panel">
      <h3>Cultos y reuniones fijas (sede Villavicencio)</h3>
      <div className="grid g4">
        {hs.filter(h => h.activo).map(h => (
          <div className="stat" key={h.id}>
            <b className="chico">{h.nombre}</b>
            <span>{DIAS[h.dia_semana]} {h.hora} · {h.modalidad}{h.plataforma ? ' · ' + h.plataforma : ''}</span>
          </div>
        ))}
      </div>
      {can('admin.sistema') && <p style={{ margin: '10px 0 0' }}><Link to="/sistema/config">Editar horarios</Link></p>}
    </div>

    <div className="acciones-top" style={{ marginTop: 20 }}>
      <h3 style={{ margin: 0 }}>Eventos especiales</h3>
      {pub && <button className="btn" onClick={() => form(null)}>+ Nuevo evento</button>}
    </div>
    {evs.length ? (
      <Tabla columnas={['Fecha', 'Evento', 'Lugar', 'Estado', 'Publicado', 'Inscritos', '']}>
        {evs.map(e => (
          <tr key={e.id}>
            <td>{e.fecha}<br /><small>{e.hora_txt}</small></td>
            <td><b>{e.titulo}</b></td>
            <td>{e.lugar || '—'}</td>
            <td><Badge estado={e.estado} /></td>
            <td>{e.publicado ? 'Sí' : 'No'}</td>
            <td>{e.requiere_inscripcion
              ? (pub ? <button className="btn sec peq" onClick={() => modal.abrir('Inscritos', <Inscritos id={e.id} />)}>{e.inscritos}</button> : e.inscritos)
              : '—'}</td>
            <td>{pub && <button className="btn sec peq" onClick={() => form(e)}>Editar</button>}</td>
          </tr>
        ))}
      </Tabla>
    ) : <Vacio panel>No hay eventos.</Vacio>}
  </>}</Cargando>;
}

function Inscritos({ id }) {
  const carga = useCarga(() => api.get(`/eventos/${id}/inscritos`), [id]);
  return <Cargando carga={carga}>{r => r.length ? (
    <Tabla columnas={['Nombre', 'Celular', 'Correo']}>
      {r.map(i => <tr key={i.id}><td>{i.nombre}</td><td>{i.celular}</td><td>{i.correo || '—'}</td></tr>)}
    </Tabla>
  ) : <Vacio>Aún no hay inscritos.</Vacio>}</Cargando>;
}

function FormEvento({ e, recargar }) {
  const { can } = useSesion();
  const modal = useModal();
  const aviso = useAviso();
  const v = e || {};
  const [imagen, setImagen] = useState(v.imagen || '');
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const subir = async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    setSubiendo(true);
    try { setImagen((await subirArchivo('/eventos/imagen', 'imagen', f)).ruta); } catch (er) { aviso.error(er); }
    finally { setSubiendo(false); }
  };
  const eliminar = async () => {
    if (!window.confirm('¿Eliminar este evento?')) return;
    try { await api.del('/eventos/' + e.id); modal.cerrar(); recargar(); } catch (er) { aviso.error(er); }
  };
  const guardar = async (ev) => {
    ev.preventDefault();
    const d = leerForm(ev.currentTarget);
    if (imagen) d.imagen = imagen;
    setOcupado(true); setError('');
    try {
      if (e) await api.put('/eventos/' + e.id, d); else await api.post('/eventos', d);
      modal.cerrar(); aviso.ok('Evento guardado'); recargar();
    } catch (er) { setError(er.message); setOcupado(false); }
  };

  return (
    <form className="form" onSubmit={guardar}>
      <div className="fila">
        <Campo label="Título" name="titulo" valor={v.titulo} req max={150} full />
        <Campo label="Tipo" name="tipo" valor={v.tipo || 'especial'} opciones={[['especial', 'Evento especial'], ['culto', 'Culto']]} />
        <Campo label="Modalidad" name="modalidad" valor={v.modalidad || 'presencial'} opciones={MODALIDADES} />
        <Campo label="Fecha" name="fecha" valor={v.fecha} tipo="date" req />
        <Campo label="Hora" name="hora" valor={v.hora ? String(v.hora).slice(0, 5) : ''} tipo="time" req />
        <Campo label="Lugar" name="lugar" valor={v.lugar} max={200} />
        <Campo label="Enlace de transmisión" name="url_transmision" valor={v.url_transmision} max={255} />
        <Campo label="Descripción" name="descripcion" valor={v.descripcion} area={3} full />
        <label className="full">Imagen (PNG, JPG o WEBP, máx. 3 MB)
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={subir} disabled={subiendo} />
        </label>
        <div className="full">{subiendo ? <small>Subiendo imagen…</small> : imagen && <img src={imagen} alt="" className="img-prev" />}</div>
        {e && <Campo label="Estado" name="estado" valor={v.estado} opciones={ESTADOS_EVENTO} />}
      </div>
      <Check label="Requiere inscripción" name="requiere_inscripcion" valor={v.requiere_inscripcion} />
      <Check label="Publicado en el sitio web" name="publicado" valor={e ? v.publicado : true} />
      {e && <small>Si cambia la fecha, el evento queda como reprogramado automáticamente.</small>}
      <p className="err">{error}</p>
      <PieForm ocupado={ocupado || subiendo}>
        {e && can('registros.eliminar') && <button type="button" className="btn peligro" onClick={eliminar}>Eliminar</button>}
      </PieForm>
    </form>
  );
}
