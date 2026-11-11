import { useState } from 'react';
import { api, leerForm } from '../../lib/api.js';
import { useCarga, useRetardo } from '../../lib/hooks.js';
import { fechaTxt } from '../../lib/formato.js';
import { ESTADOS_DISCIPULO, ESTADOS_FORMACION, MEDIOS_AUTORIZACION, SANGRE, TIPOS_ID } from '../../lib/constantes.js';
import { Badge, Campo, Cargando, Check, Opciones, Tabla, Vacio } from '../../components/ui.jsx';
import { PieForm, useModal } from '../../components/Modal.jsx';
import { useAviso } from '../../components/Avisos.jsx';
import { useSesion } from '../sesion.jsx';

const TAM = 25;
// los filtros se conservan al cambiar de página del menú y volver
let filtrosGuardados = { buscar: '', estado: '', nivel_id: '', page: 1 };

export default function Discipulos() {
  const { can, cat } = useSesion();
  const modal = useModal();
  const [f, setF] = useState(filtrosGuardados);
  const buscar = useRetardo(f.buscar, 300);
  const sens = can('discipulos.sensibles');

  const cambiar = (k, v) => setF(prev => (filtrosGuardados = { ...prev, [k]: v, page: k === 'page' ? v : 1 }));

  const carga = useCarga(() => {
    const p = new URLSearchParams({ page: f.page, size: TAM });
    if (buscar) p.set('buscar', buscar);
    if (f.estado) p.set('estado', f.estado);
    if (f.nivel_id) p.set('nivel_id', f.nivel_id);
    return api.get('/discipulos?' + p);
  }, [buscar, f.estado, f.nivel_id, f.page]);

  const abrir = (x) => modal.abrir(`${x.nombres} ${x.apellidos}`, <DetalleDiscipulo id={x.id} recargar={carga.recargar} />, 'min(820px,95vw)');
  const nuevo = () => modal.abrir('Nuevo discípulo', <FormDiscipulo recargar={carga.recargar} />, 'min(860px,95vw)');

  return <>
    <div className="acciones-top">
      <div className="filtros" style={{ margin: 0, flex: 1 }}>
        <input placeholder={`Buscar por nombre${sens ? ', documento o celular' : ''}`} value={f.buscar} onChange={e => cambiar('buscar', e.target.value)} aria-label="Buscar" />
        <select value={f.estado} onChange={e => cambiar('estado', e.target.value)} aria-label="Estado">
          <Opciones lista={[['activo', 'Activos'], ['inactivo', 'Inactivos'], ['retirado', 'Retirados']]} vacio="Todos los estados" />
        </select>
        <select value={f.nivel_id} onChange={e => cambiar('nivel_id', e.target.value)} aria-label="Función">
          <Opciones lista={cat.niveles.map(n => [n.id, n.nombre])} vacio="Todas las funciones" />
        </select>
      </div>
      {can('discipulos.editar') && <button className="btn" onClick={nuevo}>+ Nuevo discípulo</button>}
    </div>

    <Cargando carga={carga}>{r => {
      const paginas = Math.ceil(r.total / r.size) || 1;
      if (!r.filas.length) return <Vacio panel>No se encontraron discípulos.</Vacio>;
      return <>
        <Tabla columnas={['Nombre', ...(sens ? ['Documento', 'Celular'] : []), 'Función', 'Grupo', 'Estado']}>
          {r.filas.map(x => (
            <tr key={x.id} className="click" tabIndex={0} onClick={() => abrir(x)} onKeyDown={e => { if (e.key === 'Enter') abrir(x); }}>
              <td><b>{x.apellidos}</b> {x.nombres}</td>
              {sens && <><td>{x.tipo_identificacion} {x.numero_identificacion}</td><td>{x.celular}</td></>}
              <td>{x.nivel || x.funcion_iglesia || '—'}</td>
              <td>{x.grupos || '—'}</td>
              <td><Badge estado={x.estado} /></td>
            </tr>
          ))}
        </Tabla>
        <div className="paginar">
          <span>{r.total} discípulos · página {r.page} de {paginas}{carga.cargando ? ' · actualizando…' : ''}</span>
          <span>
            <button className="btn sec peq" disabled={r.page <= 1} onClick={() => cambiar('page', r.page - 1)}>Anterior</button>
            <button className="btn sec peq" disabled={r.page >= paginas} onClick={() => cambiar('page', r.page + 1)}>Siguiente</button>
          </span>
        </div>
      </>;
    }}</Cargando>
  </>;
}

const Dato = ({ t, v }) => <div><small>{t}</small><span>{v || '—'}</span></div>;

function DetalleDiscipulo({ id, recargar }) {
  const { can, cat } = useSesion();
  const modal = useModal();
  const aviso = useAviso();
  const carga = useCarga(() => api.get('/discipulos/' + id), [id]);
  const sens = can('discipulos.sensibles'), ed = can('discipulos.editar');

  const agregarFormacion = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    try { await api.post(`/discipulos/${id}/formacion`, leerForm(form)); form.reset(); carga.recargar(); } catch (er) { aviso.error(er); }
  };
  const quitarFormacion = async (fid) => {
    try { await api.del(`/discipulos/${id}/formacion/${fid}`); carga.recargar(); } catch (er) { aviso.error(er); }
  };
  const cambiarEstado = async (estado) => {
    try { await api.patch(`/discipulos/${id}/estado`, { estado }); aviso.ok('Estado actualizado'); carga.recargar(); recargar(); } catch (er) { aviso.error(er); }
  };
  const eliminar = async (x) => {
    if (!window.confirm(`¿Eliminar a ${x.nombres} ${x.apellidos}? Se borrará también su historial de asistencia. Si solo dejó de asistir, es mejor marcarlo como inactivo o retirado.`)) return;
    try { await api.del('/discipulos/' + id); modal.cerrar(); aviso.ok('Discípulo eliminado'); recargar(); } catch (er) { aviso.error(er); }
  };

  return <Cargando carga={carga}>{x => {
    return (
      <div className="detalle">
        <p><Badge estado={x.estado} /> {x.nivel && <Badge>{x.nivel}</Badge>}</p>
        <h4>Datos generales</h4>
        <div className="datos">
          <Dato t="Función en la iglesia" v={x.funcion_iglesia || x.nivel} />
          <Dato t="Sede" v={x.sede} />
          <Dato t="Supervisor (cobertura)" v={x.supervisor} />
          {sens && <>
            <Dato t="Identificación" v={`${x.tipo_identificacion} ${x.numero_identificacion}`} />
            <Dato t="Celular" v={x.celular} />
            <Dato t="Correo" v={x.correo} />
            <Dato t="Dirección" v={x.direccion} />
            <Dato t="Cumpleaños" v={fechaTxt(x.fecha_nacimiento)} />
            <Dato t="Grupo sanguíneo" v={x.grupo_sanguineo} />
            <Dato t="EPS" v={x.eps} />
            <Dato t="Contacto de emergencia" v={x.contacto_emergencia} />
            <Dato t="Celular del contacto" v={x.celular_emergencia} />
            <Dato t="Autorización de datos" v={x.autoriza_datos ? `Sí (${x.medio_autorizacion || ''} ${x.fecha_autorizacion ? fechaTxt(x.fecha_autorizacion) : ''})` : 'Pendiente'} />
          </>}
          {x.resumen_asistencia?.total > 0 && (
            <Dato t="Asistencia registrada" v={`${x.resumen_asistencia.presentes || 0} presente(s) · ${x.resumen_asistencia.ausentes || 0} ausencia(s)`} />
          )}
        </div>

        {x.nota_confidencial && <><h4>Nota confidencial</h4><div className="nota-conf">{x.nota_confidencial}</div></>}

        <h4>Ministerios</h4>
        <p>{x.ministerios.length ? x.ministerios.map(mi => <Badge key={mi.id} className="mr">{mi.nombre}</Badge>) : '—'}</p>

        <h4>Grupo de comunión</h4>
        <p>{x.grupos.length ? x.grupos.map(g => g.nombre).join(', ') : 'Sin grupo asignado'}</p>

        <h4>Formación (discipulado / adiestramiento)</h4>
        {x.formacion.length
          ? <ul className="lista-simple">{x.formacion.map(fo => (
            <li key={fo.id}>
              <span><b>{fo.programa}</b> · {fo.nivel || 'sin nivel'}<br /><small>{fo.fecha_inicio ? 'Inicio ' + fechaTxt(fo.fecha_inicio) : ''}</small></span>
              <span><Badge estado={fo.estado} /> {ed && <button className="btn sec peq" onClick={() => quitarFormacion(fo.id)}>Quitar</button>}</span>
            </li>
          ))}</ul>
          : <p>Sin registros de formación.</p>}
        {ed && (
          <form className="form" onSubmit={agregarFormacion}>
            <div className="fila">
              <Campo label="Programa" name="programa_id" req opciones={cat.programas.map(p => [p.id, p.nombre])} vacio="Seleccione" />
              <Campo label="Nivel / libro" name="nivel" />
              <Campo label="Estado" name="estado" valor="en_curso" opciones={ESTADOS_FORMACION} />
              <Campo label="Fecha de inicio" name="fecha_inicio" tipo="date" />
            </div>
            <button className="btn sec peq" style={{ marginTop: 8 }}>Agregar formación</button>
          </form>
        )}

        <div className="m-pie">
          {can('discipulos.estado') && (
            <select value={x.estado} onChange={e => cambiarEstado(e.target.value)} aria-label="Cambiar estado">
              <Opciones lista={ESTADOS_DISCIPULO} />
            </select>
          )}
          {can('registros.eliminar') && <button className="btn peligro" onClick={() => eliminar(x)}>Eliminar</button>}
          {ed && <button className="btn" onClick={() => modal.abrir('Editar discípulo', <FormDiscipulo x={x} recargar={recargar} />, 'min(860px,95vw)')}>Editar</button>}
        </div>
      </div>
    );
  }}</Cargando>;
}

function FormDiscipulo({ x, recargar }) {
  const { can, cat } = useSesion();
  const modal = useModal();
  const aviso = useAviso();
  const opciones = useCarga(() => api.get('/discipulos/opciones'));
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const v = x || {};
  const mins = new Set(x ? x.ministerios.map(a => a.id) : []);

  const guardar = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = leerForm(form);
    const ids = [...form.querySelectorAll('[data-min]:checked')].map(c => Number(c.dataset.min));
    Object.keys(datos).filter(k => k.startsWith('min_')).forEach(k => delete datos[k]);
    setOcupado(true); setError('');
    try {
      const id = x ? x.id : (await api.post('/discipulos', datos)).id;
      if (x) await api.put('/discipulos/' + x.id, datos);
      await api.put(`/discipulos/${id}/ministerios`, { ids });
      modal.cerrar(); aviso.ok('Discípulo guardado'); recargar();
    } catch (er) { setError(er.message); setOcupado(false); }
  };

  return <Cargando carga={opciones}>{ops => (
    <form className="form" onSubmit={guardar}>
      <h4>Datos personales</h4>
      <div className="fila">
        <Campo label="Nombres" name="nombres" valor={v.nombres} req max={100} />
        <Campo label="Apellidos" name="apellidos" valor={v.apellidos} req max={100} />
        <Campo label="Tipo de identificación" name="tipo_identificacion" valor={v.tipo_identificacion || 'CC'} opciones={TIPOS_ID} />
        <Campo label="Número de identificación" name="numero_identificacion" valor={v.numero_identificacion} req max={30} />
        <Campo label="Celular" name="celular" valor={v.celular} req max={25} tipo="tel" />
        <Campo label="Correo electrónico" name="correo" valor={v.correo} tipo="email" max={120} />
        <Campo label="Fecha de cumpleaños" name="fecha_nacimiento" valor={v.fecha_nacimiento} req tipo="date" />
        <Campo label="Dirección" name="direccion" valor={v.direccion} max={200} />
        <Campo label="Grupo sanguíneo (RH)" name="grupo_sanguineo" valor={v.grupo_sanguineo} opciones={SANGRE} vacio="Sin dato" />
        <Campo label="EPS" name="eps" valor={v.eps} max={80} />
        <Campo label="Contacto en caso de emergencia" name="contacto_emergencia" valor={v.contacto_emergencia} max={120} />
        <Campo label="Celular del contacto" name="celular_emergencia" valor={v.celular_emergencia} tipo="tel" max={25} />
      </div>

      <h4>Vida en la iglesia</h4>
      <div className="fila">
        <Campo label="Función (jerarquía pastoral)" name="nivel_jerarquia_id" valor={v.nivel_jerarquia_id} opciones={cat.niveles.map(n => [n.id, n.nombre])} vacio="Sin cargo pastoral" />
        <Campo label="Otra función o servicio" name="funcion_iglesia" valor={v.funcion_iglesia} max={100} />
        <Campo label="Sede" name="sede_id" valor={v.sede_id || cat.sedes.find(s => s.es_local)?.id} opciones={cat.sedes.map(s => [s.id, s.nombre])} />
        <Campo label="Supervisor (cobertura)" name="supervisor_id" valor={v.supervisor_id} opciones={ops.filter(o => !x || o.id !== x.id).map(o => [o.id, o.nombre])} vacio="Sin supervisor" />
        {can('discipulos.estado') && <Campo label="Estado" name="estado" valor={v.estado || 'activo'} opciones={ESTADOS_DISCIPULO} />}
      </div>

      <label>Ministerios (puede pertenecer a varios)</label>
      <div className="checks">
        {cat.ministerios.length
          ? cat.ministerios.map(mi => <Check key={mi.id} label={mi.nombre} name={'min_' + mi.id} data-min={mi.id} valor={mins.has(mi.id)} />)
          : <small>No hay ministerios creados.</small>}
      </div>

      <h4>Autorización de tratamiento de datos (Ley 1581 de 2012)</h4>
      <div className="fila">
        <Check label="El discípulo autoriza el tratamiento de sus datos" name="autoriza_datos" valor={v.autoriza_datos} />
        <Campo label="Medio de autorización" name="medio_autorizacion" valor={v.medio_autorizacion} opciones={MEDIOS_AUTORIZACION} vacio="Sin definir" />
        <Campo label="Fecha de autorización" name="fecha_autorizacion" valor={v.fecha_autorizacion} tipo="date" />
      </div>

      {can('discipulos.confidencial') && <>
        <h4>Información reservada (solo Pastor y Administrador)</h4>
        <Campo label="Nota confidencial" name="nota_confidencial" valor={v.nota_confidencial} area={3} max={2000} full />
      </>}

      <p className="err">{error}</p>
      <PieForm ocupado={ocupado} />
    </form>
  )}</Cargando>;
}
