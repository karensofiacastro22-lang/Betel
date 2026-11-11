import { useState } from 'react';
import { api, leerForm } from '../../lib/api.js';
import { useCarga } from '../../lib/hooks.js';
import { Campo, Cargando, Tabla, Tabs, Vacio } from '../../components/ui.jsx';
import { PieForm, useModal } from '../../components/Modal.jsx';
import { useAviso } from '../../components/Avisos.jsx';

export default function Alertas() {
  const modal = useModal();
  const [estado, setEstado] = useState('pendiente');
  const carga = useCarga(() => api.get('/alertas?estado=' + estado), [estado]);
  const pend = estado === 'pendiente';

  return <>
    <Tabs opciones={[['pendiente', 'Pendientes'], ['atendida', 'Atendidas']]} actual={estado} onCambio={setEstado} />
    <p className="gris">Se genera una alerta cuando un discípulo acumula dos inasistencias consecutivas. Le llega al Pastor y a Asistencia Pastoral.</p>
    <Cargando carga={carga}>{al => al.length ? (
      <Tabla columnas={['Discípulo', 'Celular', 'Reunión', 'Faltas seguidas', 'Última falta', pend ? '' : 'Seguimiento']}>
        {al.map(a => (
          <tr key={a.id}>
            <td><b>{a.discipulo}</b></td>
            <td>{a.celular}</td>
            <td>{a.grupo || (a.tipo_sesion === 'culto' ? 'Culto / reunión' : a.tipo_sesion)}</td>
            <td>{a.faltas_consecutivas}</td>
            <td>{a.ultima_fecha}</td>
            <td>{pend
              ? <button className="btn peq" onClick={() => modal.abrir('Registrar seguimiento', <Seguimiento id={a.id} recargar={carga.recargar} />)}>Registrar seguimiento</button>
              : (a.nota_seguimiento || '—')}</td>
          </tr>
        ))}
      </Tabla>
    ) : <Vacio panel>No hay alertas en esta lista.</Vacio>}</Cargando>
  </>;
}

function Seguimiento({ id, recargar }) {
  const modal = useModal();
  const aviso = useAviso();
  const [ocupado, setOcupado] = useState(false);
  const guardar = async (e) => {
    e.preventDefault(); setOcupado(true);
    try { await api.patch('/alertas/' + id, leerForm(e.currentTarget)); modal.cerrar(); aviso.ok('Alerta atendida'); recargar(); }
    catch (er) { aviso.error(er); setOcupado(false); }
  };
  return (
    <form className="form" onSubmit={guardar}>
      <Campo label="¿Qué se hizo con este discípulo? (llamada, visita, etc.)" name="nota" area={3} max={500} full />
      <PieForm ocupado={ocupado} textoGuardar="Marcar como atendida" />
    </form>
  );
}
