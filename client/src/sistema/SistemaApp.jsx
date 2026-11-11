import { Suspense, useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { SesionProvider, useSesion } from './sesion.jsx';
import { AvisosProvider } from '../components/Avisos.jsx';
import { ModalProvider, useModal } from '../components/Modal.jsx';
import { Vacio } from '../components/ui.jsx';
import { useTitulo } from '../lib/hooks.js';
import { RUTAS, ruta } from './rutas.js';
import Login from './Login.jsx';
import './app.css';

export default function SistemaApp() {
  useTitulo('BETEL · Sistema de gestión');
  return (
    <AvisosProvider>
      <SesionProvider>
        <ModalProvider>
          <Puerta />
        </ModalProvider>
      </SesionProvider>
    </AvisosProvider>
  );
}

// Muestra el login o el sistema según haya sesión
function Puerta() {
  const { listo, user, can } = useSesion();
  const { cerrar } = useModal();
  useEffect(() => { if (!user) cerrar(); }, [user, cerrar]);
  if (!listo) return <p className="carga-inicial">Cargando…</p>;
  if (!user) return <Login />;
  const visibles = RUTAS.filter(r => !r.sep && (!r.p || can(r.p)));
  return (
    <Routes>
      <Route element={<Diseno />}>
        {visibles.map(r => r.path
          ? <Route key={r.path} path={r.path} element={<r.C />} />
          : <Route key="panel" index element={<r.C />} />)}
        <Route path="*" element={<Navigate to={ruta('')} replace />} />
      </Route>
    </Routes>
  );
}

function Diseno() {
  const { user, can, salir } = useSesion();
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  const actual = loc.pathname.replace(/^\/sistema\/?/, '').split('/')[0];
  const r = RUTAS.find(x => !x.sep && x.path === actual) || RUTAS[0];
  useEffect(() => { setMenu(false); window.scrollTo(0, 0); }, [loc.pathname]);

  return (
    <div className="app">
      <aside className={'lateral' + (menu ? ' abierto' : '')}>
        <div className="lat-marca"><img src="/img/logo-v.png" alt="" width="40" height="40" /><div><strong>BETEL</strong><small>El Calvario</small></div></div>
        <nav className="menu">
          {RUTAS.filter(x => x.sep || !x.p || can(x.p)).map(x => x.sep
            ? <div className="sep" key={x.sep}>{x.sep}</div>
            : <NavLink key={x.path || 'panel'} to={ruta(x.path)} end={!x.path} className={({ isActive }) => (isActive ? 'act' : undefined)}>{x.t}</NavLink>)}
        </nav>
        <div className="lat-pie">
          <div><b>{user.nombre}</b><span>{user.rol_nombre}</span></div>
          <button className="btn-sec" onClick={salir}>Cerrar sesión</button>
        </div>
      </aside>
      {menu && <div className="velo" onClick={() => setMenu(false)} />}
      <div className="cuerpo">
        <header className="barra">
          <button className="btn-menu" aria-label="Menú" onClick={() => setMenu(m => !m)}>☰</button>
          <h2>{r.t}</h2>
        </header>
        <main tabIndex={-1}>
          <Suspense fallback={<Vacio>Cargando…</Vacio>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
