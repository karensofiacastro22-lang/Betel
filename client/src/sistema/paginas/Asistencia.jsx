import { useEffect, useMemo, useRef, useState } from 'react';
import { api, descargar, guardarBlob } from '../../lib/api.js';
import { useCarga } from '../../lib/hooks.js';
import { fechaTxt, hoy } from '../../lib/formato.js';
import { MARCAS_ASISTENCIA } from '../../lib/constantes.js';
import { Badge, Cargando, Opciones, Tabla, Vacio } from '../../components/ui.jsx';
import { useModal } from '../../components/Modal.jsx';
import { useAviso } from '../../components/Avisos.jsx';
import { useSesion } from '../sesion.jsx';

const TIPOS = [['culto', 'Culto o reunión'], ['evento', 'Evento especial'], ['grupo', 'Grupo de comunión']];
const CAMPO_TIPO = { culto: 'horario_id', evento: 'evento_id', grupo: 'grupo_id' };

export default function Asistencia() {
  const { esDiscipulador } = useSesion();
  const modal = useModal();
  const aviso = useAviso();
  const tipos = TIPOS.filter(t => !esDiscipulador || t[0] === 'grupo');
  const [tipo, setTipo] = useState(tipos[0][0]);
  const [objeto, setObjeto] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [abierta, setAbierta] = useState(null);       // { id, v } — v fuerza recarga al reabrir la misma lista

  const base = useCarga(async () => {
    const [horarios, eventos, grupos] = await Promise.all([
      esDiscipulador ? [] : api.get('/asistencia/horarios'),
      esDiscipulador ? [] : api.get('/eventos'),
      api.get('/grupos')
    ]);
    return { horarios, eventos, grupos };
  });
  const sesiones = useCarga(() => api.get('/asistencia/sesiones'));

  const opciones = useMemo(() => {
    const b = base.datos; if (!b) return [];
    if (tipo === 'culto') return b.horarios.map(h => [h.id, h.etiqueta]);
    if (tipo === 'evento') return b.eventos.filter(e => e.estado !== 'cancelado').slice(0, 40).map(e => [e.id, `${e.titulo} (${e.fecha})`]);
    return b.grupos.map(g => [g.id, g.nombre]);
  }, [base.datos, tipo]);

  // crea (o recupera) la lista del día para la reunión elegida
  const sesionElegida = async () => {
    const d = { tipo, fecha, [CAMPO_TIPO[tipo]]: objeto };
    return (await api.post('/asistencia/sesiones', d)).id;
  };
  const abrir = (id) => setAbierta({ id: Number(id), v: Date.now() });
  const abrirLista = async (e) => {
    e.preventDefault();
    try { abrir(await sesionElegida()); sesiones.recargar(); } catch (er) { aviso.error(er); }
  };
  const verQR = (id) => modal.abrir('Código QR de asistencia', <QrAsistencia sesionId={id} />, '520px');
  const generarQR = async () => {
    if (!objeto) return aviso.error('Seleccione primero la reunión o eucaristía');
    try { verQR(await sesionElegida()); sesiones.recargar(); } catch (er) { aviso.error(er); }
  };

  return <>
    <div className="panel">
      <h3>Tomar asistencia</h3>
      <Cargando carga={base}>{() => (
        <form className="form" onSubmit={abrirLista}>
          <div className="fila">
            <label>Tipo
              <select value={tipo} onChange={e => { setTipo(e.target.value); setObjeto(''); }}><Opciones lista={tipos} /></select>
            </label>
            <label>Reunión
              <select required value={objeto} onChange={e => setObjeto(e.target.value)}>
                <Opciones lista={opciones} vacio={opciones.length ? 'Seleccione' : 'No hay opciones disponibles'} />
              </select>
            </label>
            <label>Fecha *<input type="date" required value={fecha} onChange={e => setFecha(e.target.value)} /></label>
          </div>
          <div className="m-pie" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
            <button className="btn">Abrir lista</button>
            <button className="btn sec" type="button" onClick={generarQR}>Generar código QR</button>
          </div>
        </form>
      )}</Cargando>
    </div>

    {abierta && (
      <ListaAsistencia key={abierta.v} id={abierta.id} verQR={verQR}
        onCambio={sesiones.recargar} onEliminada={() => { setAbierta(null); sesiones.recargar(); }} />
    )}

    <div className="panel mt">
      <h3>Registros recientes</h3>
      <Cargando carga={sesiones}>{ss => ss.length ? (
        <Tabla columnas={['Fecha', 'Reunión', 'Tipo', 'Presentes', 'Ausentes', 'Visitantes', '']}>
          {ss.map(s => (
            <tr key={s.id}>
              <td>{s.fecha}</td><td>{s.nombre}</td><td>{s.tipo}</td>
              <td>{s.presentes || 0}</td><td>{s.ausentes || 0}</td><td>{s.visitantes || 0}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="btn sec peq" onClick={() => abrir(s.id)}>Abrir</button>{' '}
                <button className="btn sec peq" onClick={() => verQR(s.id)}>QR</button>
              </td>
            </tr>
          ))}
        </Tabla>
      ) : <Vacio>Aún no hay registros.</Vacio>}</Cargando>
    </div>
  </>;
}

// ---------- Lista de un día ----------
function ListaAsistencia({ id, verQR, onCambio, onEliminada }) {
  const { can } = useSesion();
  const aviso = useAviso();
  const [d, setD] = useState(null);
  const [marcas, setMarcas] = useState({});           // discipulo_id -> estado elegido en pantalla
  const [pendientes, setPendientes] = useState([]);   // visitantes agregados sin guardar
  const [nombreV, setNombreV] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const caja = useRef(null);

  const traer = async (fusionar) => {
    const nuevo = await api.get('/asistencia/sesiones/' + id);
    setD(nuevo);
    // al actualizar se conservan las marcas hechas en pantalla, salvo las que ya tienen registro en el servidor
    setMarcas(m => {
      const r = fusionar ? { ...m } : {};
      nuevo.lista.forEach(x => { if (x.estado) r[x.discipulo_id] = x.estado; });
      return r;
    });
    return nuevo;
  };

  useEffect(() => {
    traer(false).then(() => caja.current?.scrollIntoView({ behavior: 'smooth' })).catch(aviso.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!d) return <div className="mt"><Vacio panel>Cargando lista…</Vacio></div>;

  const bloqueado = (x) => !!x.estado && !d.puede_corregir;
  const marcados = d.lista.filter(x => marcas[x.discipulo_id]).length;

  const marcarTodos = () => setMarcas(m => {
    const r = { ...m };
    d.lista.forEach(x => { if (!bloqueado(x) && !r[x.discipulo_id]) r[x.discipulo_id] = 'presente'; });
    return r;
  });
  const actualizar = async () => {
    try { await traer(true); aviso.ok('Lista actualizada'); } catch (er) { aviso.error(er); }
  };
  const agregarVisitante = () => {
    const v = nombreV.trim(); if (!v) return;
    setPendientes(p => [...p, v]); setNombreV('');
  };
  const quitarVisitante = async (vid) => {
    try { await api.del(`/asistencia/sesiones/${id}/visitantes/${vid}`); await traer(true); onCambio(); } catch (er) { aviso.error(er); }
  };
  const eliminar = async () => {
    if (!window.confirm('¿Eliminar esta lista de asistencia completa?')) return;
    try { await api.del('/asistencia/sesiones/' + id); aviso.ok('Lista eliminada'); onEliminada(); } catch (er) { aviso.error(er); }
  };
  const guardar = async () => {
    const registros = d.lista.filter(x => marcas[x.discipulo_id] && !bloqueado(x))
      .map(x => ({ discipulo_id: x.discipulo_id, estado: marcas[x.discipulo_id] }));
    setOcupado(true);
    try {
      const r = await api.put(`/asistencia/sesiones/${id}/registros`, { registros, visitantes: pendientes.map(nombre => ({ nombre })) });
      aviso.ok(`Asistencia guardada (${r.guardados} registros)`);
      if (r.bloqueados) aviso.error(`${r.bloqueados} cambio(s) no permitido(s): solo Asistencia Pastoral o el Pastor corrigen`);
      setPendientes([]);
      await traer(false); onCambio();
    } catch (er) { aviso.error(er); }
    finally { setOcupado(false); }
  };
  const informe = (formato) => descargar(`/api/reportes/asistencia?sesion_id=${id}&formato=${formato}`).catch(aviso.error);

  return (
    <div className="panel mt" ref={caja}>
      <h3>{d.sesion.nombre} · {d.sesion.fecha}</h3>
      <div className="acciones-top">
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="btn sec peq" onClick={marcarTodos}>Marcar todos como presentes</button>
          <button className="btn peq" onClick={() => verQR(id)}>Código QR</button>
          <button className="btn sec peq" onClick={actualizar} title="Trae las asistencias que los discípulos marcaron con el QR">Actualizar</button>
        </span>
        <span className="gris">{marcados} de {d.lista.length} marcados</span>
      </div>

      <Tabla columnas={['Discípulo', 'Estado']}>
        {d.lista.length ? d.lista.map(x => {
          const lock = bloqueado(x);
          return (
            <tr key={x.discipulo_id}>
              <td>
                {x.nombre}
                {x.por_qr && <> <Badge estado="visitante">QR</Badge></>}
                {x.corregido && <> <small title="Corregido">(corregido)</small></>}
              </td>
              <td>
                <div className="radios">
                  {MARCAS_ASISTENCIA.map(([v, c, t]) => (
                    <label key={v}>
                      <input type="radio" name={'r' + x.discipulo_id} value={v} disabled={lock}
                        checked={marcas[x.discipulo_id] === v}
                        onChange={() => setMarcas(m => ({ ...m, [x.discipulo_id]: v }))} />
                      <span className={c}>{t}</span>
                    </label>
                  ))}
                </div>
              </td>
            </tr>
          );
        }) : <tr><td colSpan={2} className="vacio">No hay discípulos activos para esta reunión.</td></tr>}
      </Tabla>

      <h4 style={{ margin: '18px 0 6px' }}>Visitantes</h4>
      <ul className="lista-simple">
        {d.visitantes.map(v => (
          <li key={v.id}>
            <span>{v.nombre}{v.por_qr && <> <Badge estado="visitante">QR</Badge></>}</span>
            {d.puede_corregir && <button className="btn sec peq" onClick={() => quitarVisitante(v.id)}>Quitar</button>}
          </li>
        ))}
        {pendientes.map((n, i) => (
          <li key={'p' + i}>
            <span>{n} <small>(sin guardar)</small></span>
            <button className="btn sec peq" onClick={() => setPendientes(p => p.filter((_, j) => j !== i))}>Quitar</button>
          </li>
        ))}
      </ul>
      <div className="filtros" style={{ marginTop: 8 }}>
        <input placeholder="Nombre del visitante" maxLength={150} value={nombreV}
          onChange={e => setNombreV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarVisitante(); } }} />
        <button className="btn sec" type="button" onClick={agregarVisitante}>Agregar visitante</button>
      </div>

      <div className="m-pie">
        {can('registros.eliminar') && <button className="btn peligro" onClick={eliminar}>Eliminar esta lista</button>}
        {can('reportes.ver') && <>
          <button className="btn sec" onClick={() => informe('pdf')}>Informe PDF</button>
          <button className="btn sec" onClick={() => informe('xlsx')}>Informe Excel</button>
        </>}
        <button className="btn" onClick={guardar} disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar asistencia'}</button>
      </div>
    </div>
  );
}

// ---------- Código QR (uno distinto por cada eucaristía/reunión y por cada día) ----------
function QrAsistencia({ sesionId }) {
  const { can } = useSesion();
  const aviso = useAviso();
  const carga = useCarga(() => api.get(`/asistencia/sesiones/${sesionId}/qr`), [sesionId]);

  return <Cargando carga={carga}>{d => {
    const img = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(d.svg);
    const copiar = async () => {
      try { await navigator.clipboard.writeText(d.url); aviso.ok('Enlace copiado'); }
      catch { aviso.error('No se pudo copiar; selecciónelo manualmente'); }
    };
    const png = () => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas'); c.width = c.height = 1000;
        const g = c.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, 1000, 1000); g.imageSmoothingEnabled = false; g.drawImage(im, 0, 0, 1000, 1000);
        c.toBlob(b => guardarBlob(b, `qr_asistencia_${d.fecha}.png`));
      };
      im.src = img;
    };
    const imprimir = () => {
      const w = window.open('', '_blank');
      if (!w) return aviso.error('El navegador bloqueó la ventana de impresión');
      const doc = w.document;
      doc.title = 'QR ' + d.nombre;
      doc.body.style.cssText = 'font-family:Segoe UI,Arial,sans-serif;text-align:center;margin:40px';
      const add = (tag, texto) => { const e = doc.createElement(tag); e.textContent = texto; doc.body.append(e); return e; };
      add('h1', 'Misión Cristiana El Calvario'); add('h2', d.nombre); add('h3', fechaTxt(d.fecha));
      const i = doc.createElement('img'); i.src = img; i.style.cssText = 'width:420px;height:420px'; doc.body.append(i);
      add('p', 'Escanee este código para registrar su asistencia').style.fontSize = '20px';
      w.focus(); setTimeout(() => w.print(), 400);
    };
    const regenerar = async () => {
      if (!window.confirm('Se creará un QR nuevo y el anterior dejará de funcionar. ¿Continuar?')) return;
      try { await api.post(`/asistencia/sesiones/${sesionId}/qr/regenerar`); aviso.ok('QR regenerado'); carga.recargar(); } catch (er) { aviso.error(er); }
    };
    return <>
      <div className="qr">
        <h3>{d.nombre}</h3>
        <p className="fecha">{fechaTxt(d.fecha)}</p>
        <img src={img} alt="Código QR" width="280" height="280" />
        <p className="nota">Este código solo funciona el día indicado y solo para esta reunión.<br />Los discípulos lo escanean y escriben su número de identificación.</p>
        <p className="url">{d.url}</p>
        {d.es_local && <p className="err">Atención: la dirección dice «localhost», así que los celulares no podrán abrirla. Configure BASE_URL en el archivo .env con la dirección real del sistema.</p>}
      </div>
      <div className="m-pie">
        <button className="btn sec" onClick={copiar}>Copiar enlace</button>
        <button className="btn sec" onClick={png}>Descargar PNG</button>
        <button className="btn sec" onClick={imprimir}>Imprimir</button>
        {can('asistencia.corregir') && <button className="btn peligro" onClick={regenerar}>Generar uno nuevo</button>}
      </div>
    </>;
  }}</Cargando>;
}
