import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './base.css';

// Cada área se descarga solo cuando se visita (el sitio público no carga el código del sistema y viceversa)
const Sitio = lazy(() => import('./sitio/Sitio.jsx'));
const Asistir = lazy(() => import('./asistir/Asistir.jsx'));
const Sistema = lazy(() => import('./sistema/SistemaApp.jsx'));

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={<p className="carga-inicial">Cargando…</p>}>
        <Routes>
          <Route path="/" element={<Sitio />} />
          <Route path="/a/:token" element={<Asistir />} />
          <Route path="/sistema/*" element={<Sistema />} />
          <Route path="*" element={<Sitio />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>
);
