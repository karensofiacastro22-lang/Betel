import { useRef } from 'react';
import { api, descargar, leerForm } from '../../lib/api.js';
import { useCarga } from '../../lib/hooks.js';
import { MESES, capital, hoy } from '../../lib/formato.js';
import { Campo, Cargando } from '../../components/ui.jsx';
import { useAviso } from '../../components/Avisos.jsx';
import { useSesion } from '../sesion.jsx';

export default function Reportes() {
  const { can, esDiscipulador } = useSesion();
  const aviso = useAviso();
  const fAsistencia = useRef(null), fCumple = useRef(null);
  const carga = useCarga(async () => {
    const [grupos, horarios] = await Promise.all([api.get('/grupos'), esDiscipulador ? [] : api.get('/asistencia/horarios')]);
    return { grupos, horarios };
  });

  const bajar = (tipo, formRef, formato) => {
    const p = new URLSearchParams();
    if (formRef?.current) Object.entries(leerForm(formRef.current)).forEach(([k, v]) => { if (v) p.set(k, v); });
    p.set('formato', formato);
    descargar(`/api/reportes/${tipo}?${p}`).catch(aviso.error);
  };
  const Botones = ({ tipo, formRef }) => (
    <p style={{ marginTop: 12, display: 'flex', gap: 6 }}>
      <button className="btn peq" onClick={() => bajar(tipo, formRef, 'pdf')}>PDF</button>
      <button className="btn sec peq" onClick={() => bajar(tipo, formRef, 'xlsx')}>Excel</button>
    </p>
  );

  return <Cargando carga={carga}>{({ grupos, horarios }) => (
    <div className="grid g3">
      <div className="panel">
        <h3>Asistencia</h3>
        <form className="form" ref={fAsistencia} onSubmit={e => e.preventDefault()}>
          <Campo label="Desde" name="desde" tipo="date" />
          <Campo label="Hasta" name="hasta" tipo="date" valor={hoy()} />
          <Campo label="Tipo" name="tipo" opciones={[['culto', 'Cultos y reuniones'], ['evento', 'Eventos'], ['grupo', 'Grupos de comunión']]} vacio="Todos" />
          {horarios.length > 0 && <Campo label="Eucaristía / reunión" name="horario_id" opciones={horarios.map(h => [h.id, h.etiqueta])} vacio="Todas" />}
          <Campo label="Grupo" name="grupo_id" opciones={grupos.map(g => [g.id, g.nombre])} vacio="Todos" />
        </form>
        <Botones tipo="asistencia" formRef={fAsistencia} />
      </div>

      {can('reportes.cumpleanos') && (
        <div className="panel">
          <h3>Listado de cumpleaños</h3>
          <form className="form" ref={fCumple} onSubmit={e => e.preventDefault()}>
            <Campo label="Mes" name="mes" valor={new Date().getMonth() + 1} opciones={MESES.map((x, i) => [i + 1, capital(x)])} vacio="Todo el año" />
          </form>
          <Botones tipo="cumpleanos" formRef={fCumple} />
        </div>
      )}

      <div className="panel">
        <h3>Grupos de comunión familiar</h3>
        <p className="gris">Grupos, discipuladores y discípulos activos.</p>
        <Botones tipo="grupos" />
      </div>
    </div>
  )}</Cargando>;
}
