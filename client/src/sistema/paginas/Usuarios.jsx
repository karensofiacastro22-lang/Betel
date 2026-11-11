import { useState } from 'react';
import { api, leerForm } from '../../lib/api.js';
import { useCarga } from '../../lib/hooks.js';
import { Badge, Campo, Cargando, Check, Tabla } from '../../components/ui.jsx';
import { PieForm, useModal } from '../../components/Modal.jsx';
import { useAviso } from '../../components/Avisos.jsx';
import { useSesion } from '../sesion.jsx';

export default function Usuarios() {
  const modal = useModal();
  const carga = useCarga(() => api.get('/usuarios'));
  const form = (u) => modal.abrir(u ? 'Editar usuario' : 'Nuevo usuario', <FormUsuario u={u} recargar={carga.recargar} />);
  return <Cargando carga={carga}>{us => <>
    <div className="acciones-top">
      <span className="gris">Tienen usuario: Pastor, Asistentes Pastorales, Discipuladores y Multimedia.</span>
      <button className="btn" onClick={() => form(null)}>+ Nuevo usuario</button>
    </div>
    <Tabla columnas={['Nombre', 'Correo', 'Rol', 'Estado', 'Último acceso', '']}>
      {us.map(u => (
        <tr key={u.id}>
          <td><b>{u.nombre}</b></td><td>{u.correo}</td><td>{u.rol}</td>
          <td><Badge estado={u.activo ? 'activo' : 'inactivo'} /></td>
          <td>{u.ultimo_acceso || '—'}</td>
          <td><button className="btn sec peq" onClick={() => form(u)}>Editar</button></td>
        </tr>
      ))}
    </Tabla>
  </>}</Cargando>;
}

function FormUsuario({ u, recargar }) {
  const { cat } = useSesion();
  const modal = useModal();
  const aviso = useAviso();
  const opciones = useCarga(() => api.get('/discipulos/opciones'));
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const v = u || {};

  const guardar = async (e) => {
    e.preventDefault();
    const d = leerForm(e.currentTarget);
    setOcupado(true); setError('');
    try {
      if (u) await api.put('/usuarios/' + u.id, d); else await api.post('/usuarios', d);
      modal.cerrar(); aviso.ok('Usuario guardado'); recargar();
    } catch (er) { setError(er.message); setOcupado(false); }
  };

  return <Cargando carga={opciones}>{ops => (
    <form className="form" onSubmit={guardar}>
      <div className="fila">
        <Campo label="Nombre" name="nombre" valor={v.nombre} req max={120} />
        <Campo label="Correo" name="correo" valor={v.correo} req tipo="email" max={120} />
        <Campo label="Rol" name="rol_id" valor={v.rol_id} req opciones={cat.roles.map(r => [r.id, r.nombre])} />
        <Campo label="Discípulo vinculado (necesario para Discipuladores)" name="discipulo_id" valor={v.discipulo_id} opciones={ops.map(o => [o.id, o.nombre])} vacio="Ninguno" />
        <Campo label={u ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña (mín. 8 caracteres)'} name="password" tipo="password" req={!u} max={72} autoComplete="new-password" />
      </div>
      {u && <Check label="Usuario activo" name="activo" valor={v.activo} />}
      <p className="err">{error}</p>
      <PieForm ocupado={ocupado} />
    </form>
  )}</Cargando>;
}
