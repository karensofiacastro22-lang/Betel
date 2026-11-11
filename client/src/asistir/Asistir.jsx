// Página que abre el código QR: el discípulo escribe su identificación (o el visitante su nombre)
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
  if (!r.ok) throw new Error(j.error || 'No se pudo completar el registro. Intente de nuevo.');
  return j;
}

export default function Asistir() {
  useTitulo('Registrar asistencia · El Calvario');
  const { token } = useParams();
  const [reunion, setReunion] = useState('Cargando…');
  const [abierta, setAbierta] = useState(false);
  const [visitante, setVisitante] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState({ t: '', c: '' });
  const entrada = useRef(null);

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

  useEffect(() => { if (abierta) entrada.current?.focus(); }, [visitante, abierta]);

  const cambiar = (v) => { setVisitante(v); setMsg({ t: '', c: '' }); };

  const enviar = async (e) => {
    e.preventDefault();
    const valor = entrada.current.value;
    setOcupado(true); setMsg({ t: 'Registrando…', c: '' });
    try {
      const r = await llamar(token, 'POST', visitante ? { visitante_nombre: valor } : { numero_identificacion: valor });
      setMsg({ t: r.mensaje, c: 'ok' }); setAbierta(false);
    } catch (er) { setMsg({ t: er.message, c: 'err' }); }
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
            {visitante ? (
              <label key="v">Su nombre completo
                <input ref={entrada} name="visitante_nombre" autoComplete="name" maxLength={150} placeholder="Nombre y apellido" />
              </label>
            ) : (
              <label key="d">Número de identificación
                <input ref={entrada} name="numero_identificacion" inputMode="numeric" autoComplete="off" placeholder="Sin puntos ni espacios" />
              </label>
            )}
            <button className="btn" type="submit" disabled={ocupado}>{visitante ? 'Registrar mi visita' : 'Registrar mi asistencia'}</button>
            <button className="enlace" type="button" onClick={() => cambiar(!visitante)}>{visitante ? 'Soy discípulo' : 'Soy visitante'}</button>
          </form>
        )}

        <p className={'msg ' + msg.c} role="status" aria-live="polite">{msg.t}</p>
      </main>
    </div>
  );
}
