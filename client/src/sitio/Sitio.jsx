import { useEffect, useRef, useState } from 'react';
import { DIAS, fechaCorta, hora12 } from '../lib/formato.js';
import { MODALIDAD_TXT } from '../lib/constantes.js';
import { useTitulo } from '../lib/hooks.js';
import './sitio.css';

const SECCIONES = [['iglesia', 'La iglesia'], ['horarios', 'Horarios'], ['eventos', 'Eventos'], ['sedes', 'Sedes'], ['contacto', 'Contacto']];
const Aviso = ({ children }) => <p className="cargando">{children}</p>;
const PorConfirmar = () => <span className="pendiente">Por confirmar</span>;

export default function Sitio() {
  useTitulo('Misión Cristiana El Calvario · Villavicencio, Colombia');
  const [info, setInfo] = useState(null);
  const [fallo, setFallo] = useState(false);
  const [menu, setMenu] = useState(false);
  const [inscribir, setInscribir] = useState(null);

  useEffect(() => {
    fetch('/api/publico/info').then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setInfo).catch(() => setFallo(true));
  }, []);

  const estado = (lista, vacio, render) =>
    fallo ? <Aviso>No se pudo cargar la información. Intente de nuevo más tarde.</Aviso>
      : !info ? <Aviso>Cargando…</Aviso>
        : !lista(info).length ? <Aviso>{vacio}</Aviso> : render(lista(info));

  const local = info?.sedes.find(s => s.es_local) || {};

  return (
    <div className="sitio">
      <header className="top">
        <a className="marca" href="#inicio">
          <img src="/img/logo-v.png" alt="Logo El Calvario" width="44" height="44" />
          <span>Misión Cristiana<br /><strong>El Calvario</strong></span>
        </a>
        <button className="menu-btn" aria-label="Abrir menú" aria-expanded={menu} onClick={() => setMenu(m => !m)}>☰</button>
        <nav className={menu ? 'abierto' : ''} onClick={(e) => { if (e.target.tagName === 'A') setMenu(false); }}>
          {SECCIONES.map(([id, t]) => <a key={id} href={`#${id}`}>{t}</a>)}
          {/* enlace normal (no de React Router) para cargar solo el código del sistema */}
          <a className="acceso" href="/sistema">Ingresar a BETEL</a>
        </nav>
      </header>

      <main>
        <section className="hero" id="inicio">
          <div className="hero-in">
            <p className="etiqueta">Villavicencio · Meta · Colombia</p>
            <h1>Misión Cristiana <span>El Calvario</span></h1>
            <p className="lead">Sede Villavicencio. Consulte aquí los horarios de servicio, los próximos eventos y la información de nuestras sedes.</p>
            <div className="hero-btn">
              <a className="btn" href="#horarios">Ver horarios</a>
              <a className="btn ghost" href="#eventos">Próximos eventos</a>
            </div>
          </div>
          <img className="hero-logo" src="/img/logo-v.png" alt="" width="320" height="320" />
        </section>

        <section className="bloque" id="iglesia">
          <h2>La iglesia</h2>
          <div className="tres">
            {[['01', 'Visión', 'Establecer el Reino de Dios en la tierra.'],
              ['02', 'Misión', 'Alcanzar las naciones para Cristo.'],
              ['03', 'Propósito', 'Presentar a todo hombre perfecto en Cristo Jesús.']].map(([n, t, p]) => (
              <article className="tarjeta" key={n}><span className="num">{n}</span><h3>{t}</h3><p>{p}</p></article>
            ))}
          </div>
          <div className="info-iglesia">
            <div>
              <h3>Cómo está organizada</h3>
              <p>La iglesia se organiza en una estructura pastoral con cobertura en cada nivel: Apóstol General, Asistencia Apostólica, Pastor de Distrito, Pastor Local, Asistencia Pastoral y Discipuladores.</p>
            </div>
            <div>
              <h3>Grupos de comunión familiar</h3>
              <p>Los discípulos se reúnen en grupos de comunión familiar guiados por discipuladores. Cuando un grupo alcanza su máximo de discípulos, el propósito es abrir una nueva iglesia con ese grupo.</p>
            </div>
          </div>
        </section>

        <section className="bloque oscuro" id="horarios">
          <h2>Horarios</h2>
          <p className="sub">Sede Villavicencio</p>
          <div className="horarios">
            {estado(i => i.horarios, 'Los horarios se publicarán próximamente.', hs => hs.map(h => (
              <article className="horario" key={h.id}>
                <div className="dia">{DIAS[h.dia_semana]}</div>
                <div className="hora">{hora12(h.hora)}</div>
                <h3>{h.nombre}</h3>
                <span className="chip">{MODALIDAD_TXT[h.modalidad]}</span>
                {h.plataforma && <span className="chip">{h.plataforma}</span>}
              </article>
            )))}
          </div>
        </section>

        <section className="bloque" id="eventos">
          <h2>Próximos eventos</h2>
          <div className="eventos">
            {estado(i => i.eventos, 'No hay eventos programados por el momento.', evs => evs.map(e => (
              <article className="evento" key={e.id}>
                {e.imagen
                  ? <img src={e.imagen} alt={e.titulo} loading="lazy" />
                  : <div className="sin-img"><img src="/img/logo-v.png" alt="" /></div>}
                <div className="cuerpo">
                  {e.estado === 'reprogramado' && <span className="etq-estado">Reprogramado</span>}
                  <div className="fecha">{fechaCorta(e.fecha)} · {hora12(e.hora)}</div>
                  <h3>{e.titulo}</h3>
                  {e.lugar && <p>{e.lugar}</p>}
                  <p>{MODALIDAD_TXT[e.modalidad]}</p>
                  {e.descripcion && <p>{e.descripcion}</p>}
                  {!!e.requiere_inscripcion && <button className="btn" type="button" onClick={() => setInscribir(e)}>Inscribirme</button>}
                </div>
              </article>
            )))}
          </div>
        </section>

        <section className="bloque claro" id="sedes">
          <h2>Nuestras sedes</h2>
          <p className="sub">Información básica de cada sede.</p>
          <div className="sedes">
            {estado(i => i.sedes, 'Sin sedes registradas.', ss => ss.map(s => (
              <article className={'sede' + (s.es_principal ? ' principal' : '')} key={s.id}>
                <div>
                  {!!s.es_principal && <span className="etq rojo">Sede principal</span>}
                  {!!s.es_local && <span className="etq">Sede local</span>}
                </div>
                <h3>{s.nombre}</h3>
                <p className="pais">{s.pais}</p>
                {s.descripcion && <p>{s.descripcion}</p>}
                <dl>
                  <dt>Ciudad</dt><dd>{s.ciudad || <PorConfirmar />}</dd>
                  <dt>Dirección</dt><dd>{s.direccion || <PorConfirmar />}</dd>
                  {s.telefono && <><dt>Teléfono</dt><dd>{s.telefono}</dd></>}
                </dl>
              </article>
            )))}
          </div>
        </section>

        <section className="bloque" id="contacto">
          <h2>Contacto</h2>
          <div className="contacto">
            {fallo ? <Aviso>No se pudo cargar la información. Intente de nuevo más tarde.</Aviso>
              : !info ? <Aviso>Cargando…</Aviso>
                : [['Ubicación', [local.direccion, local.ciudad, local.pais].filter(Boolean).join(', ')], ['Teléfono', local.telefono], ['Correo', local.correo]]
                  .map(([t, v]) => <div key={t}><b>{t}</b>{v ? <span>{v}</span> : <PorConfirmar />}</div>)}
          </div>
        </section>
      </main>

      <footer>
        <div className="pie-logo"><img src="/img/logo-calvario.png" alt="Misión Cristiana El Calvario" width="120" height="120" /></div>
        <div>
          <p><strong>Misión Cristiana El Calvario Villavicencio</strong></p>
          <p>© {new Date().getFullYear()} · Los datos personales se tratan conforme a la Ley 1581 de 2012.</p>
          <p><a href="/sistema">Acceso al sistema BETEL</a></p>
        </div>
      </footer>

      <Inscripcion evento={inscribir} onCerrar={() => setInscribir(null)} />
    </div>
  );
}

function Inscripcion({ evento, onCerrar }) {
  const ref = useRef(null);
  const [msg, setMsg] = useState({ t: '', c: '' });
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (evento && !d.open) { setMsg({ t: '', c: '' }); d.showModal(); }
    if (!evento && d.open) d.close();
  }, [evento]);

  const enviar = async (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    setOcupado(true);
    try {
      const r = await fetch(`/api/publico/eventos/${evento.id}/inscripcion`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'No se pudo completar la inscripción');
      setMsg({ t: 'Inscripción registrada. ¡Gracias!', c: 'ok' });
      form.reset();
      setTimeout(onCerrar, 1500);
    } catch (e) { setMsg({ t: e.message, c: 'err' }); }
    finally { setOcupado(false); }
  };

  return (
    <dialog ref={ref} onClose={onCerrar}>
      {evento && (
        <form onSubmit={enviar}>
          <h3>Inscripción</h3>
          <p className="sub">{evento.titulo} · {fechaCorta(evento.fecha)}</p>
          <label>Nombre completo<input name="nombre" required maxLength={150} autoComplete="name" /></label>
          <label>Celular<input name="celular" required maxLength={25} inputMode="tel" autoComplete="tel" /></label>
          <label>Correo (opcional)<input name="correo" type="email" maxLength={120} autoComplete="email" /></label>
          <p className={'msg ' + msg.c} role="status">{msg.t}</p>
          <div className="acciones">
            <button type="button" className="btn ghost oscuro-txt" onClick={onCerrar}>Cancelar</button>
            <button className="btn" type="submit" disabled={ocupado}>Inscribirme</button>
          </div>
        </form>
      )}
    </dialog>
  );
}
