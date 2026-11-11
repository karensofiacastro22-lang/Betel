// Página que abre el código QR: la persona escribe su cédula. Si ya está registrada, queda su asistencia;
// si no, se le piden nombres y apellidos, se registra como discípulo y queda su asistencia.
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fechaLarga } from '../lib/formato.js';
import { useTitulo } from '../lib/hooks.js';
import './asistir.css';

async function llamar(token, metodo, cuerpo) {
  const r = await fetch('/api/asistir/' + encodeURIComponent(token), {
    method: metodo, headers: cuerpo ? { 'Content-Type': 'application/json' } : {}, body: cuerpo ? JSON.stringify(cuerpo) : undefined
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j.error || 'No se pudo completar el registro. Intente de nuevo.');
    e.registrar = Boolean(j.registrar);    // el número no está registrado: hay que pedir sus datos
    throw e;
  }
  return j;
}

export default function Asistir() {
  useTitulo('Registrar asistencia · El Calvario');
  const { token } = useParams();
  const [reunion, setReunion] = useState('Cargando…');
  const [abierta, setAbierta] = useState(false);
  const [paso, setPaso] = useState('doc');          // 'doc': solo cédula · 'registro': nombres, apellidos y cédula
  const [datos, setDatos] = useState({ numero_identificacion: '', nombres: '', apellidos: '' });
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState({ t: '', c: '' });
  const entrada = useRef(null);
  const campo = (k) => (e) => setDatos(d => ({ ...d, [k]: e.target.value }));

  useEffect(() => {
    // evita que los buscadores indexen esta página
    const meta = document.createElement('meta'); meta.name = 'robots'; meta.content = 'noindex';
    document.head.append(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    llamar(token, 'GET').then(i => {
      setReunion(`${i.nombre} · ${fechaLarga(i.fecha)}`);
      if (i.abierta) setAbierta(true);
      else setMsg({ t: i.dia === 'futuro' ? 'Este código todavía no está habilitado: solo sirve el día de la reunión.' : 'Este código ya venció: solo sirve el día de la reunión.', c: 'err' });
    }).catch(e => { setReunion(''); setMsg({ t: e.message, c: 'err' }); });
  }, [token]);

  useEffect(() => { if (abierta) entrada.current?.focus(); }, [paso, abierta]);

  const volver = () => { setPaso('doc'); setMsg({ t: '', c: '' }); };

  const enviar = async (e) => {
    e.preventDefault();
    if (!datos.numero_identificacion.trim()) return setMsg({ t: 'Escriba su número de cédula.', c: 'err' });
    setOcupado(true); setMsg({ t: 'Registrando…', c: '' });
    try {
      const cuerpo = paso === 'doc' ? { numero_identificacion: datos.numero_identificacion } : datos;
      const r = await llamar(token, 'POST', cuerpo);
      setMsg({ t: r.mensaje, c: 'ok' }); setAbierta(false);
    } catch (er) {
      if (er.registrar && paso === 'doc') { setPaso('registro'); setMsg({ t: er.message, c: '' }); }
      else setMsg({ t: er.message, c: 'err' });
    }
    finally { setOcupado(false); }
  };

  return (
    <div className="asistir">
      <main className="tarjeta-qr">
        <img src="/img/logo-v.png" alt="Logo El Calvario" width="84" height="84" />
        <h1>Registrar asistencia</h1>
        <p className="reunion">{reunion}</p>

        {abierta && (
          <form onSubmit={enviar} noValidate>
            {paso === 'doc' ? (
              <label key="d">Número de cédula
                <input ref={entrada} name="numero_identificacion" inputMode="numeric" autoComplete="off" maxLength={30}
                  placeholder="Sin puntos ni espacios" value={datos.numero_identificacion} onChange={campo('numero_identificacion')} />
              </label>
            ) : (
              <>
                <label key="n">Nombres
                  <input ref={entrada} name="nombres" autoComplete="given-name" maxLength={100} required
                    value={datos.nombres} onChange={campo('nombres')} />
                </label>
                <label key="a">Apellidos
                  <input name="apellidos" autoComplete="family-name" maxLength={100} required
                    value={datos.apellidos} onChange={campo('apellidos')} />
                </label>
                <label key="c">Número de cédula
                  <input name="numero_identificacion" inputMode="numeric" autoComplete="off" maxLength={30} required
                    value={datos.numero_identificacion} onChange={campo('numero_identificacion')} />
                </label>
              </>
            )}
            <button className="btn" type="submit" disabled={ocupado}>
              {paso === 'doc' ? 'Registrar mi asistencia' : 'Registrarme y marcar asistencia'}
            </button>
            {paso === 'registro' && <button className="enlace" type="button" onClick={volver}>Ya estoy registrado(a): volver</button>}
          </form>
        )}

        <p className={'msg ' + msg.c} role="status" aria-live="polite">{msg.t}</p>
      </main>
    </div>
  );
}
