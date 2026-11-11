import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, alExpirarSesion } from '../lib/api.js';

// Usuario conectado, sus permisos y los catálogos (roles, niveles, ministerios, programas, sedes)
const Ctx = createContext(null);
const SIN_SESION = { listo: true, user: null, cat: null };

export function SesionProvider({ children }) {
  const [st, setSt] = useState({ listo: false, user: null, cat: null });

  const iniciar = useCallback(async () => {
    try {
      const [user, cat] = await Promise.all([api.get('/auth/me'), api.get('/catalogos')]);
      setSt({ listo: true, user, cat });
    } catch { setSt(SIN_SESION); }
  }, []);

  useEffect(() => {
    alExpirarSesion(() => setSt(SIN_SESION));
    iniciar();
    return () => alExpirarSesion(null);
  }, [iniciar]);

  const salir = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setSt(SIN_SESION);
  }, []);

  const recargarCatalogos = useCallback(async () => {
    const cat = await api.get('/catalogos');
    setSt(s => ({ ...s, cat }));
    return cat;
  }, []);

  const valor = useMemo(() => {
    const permisos = new Set(st.user?.permisos || []);
    return {
      ...st,
      can: (p) => permisos.has(p),
      esDiscipulador: st.user?.rol === 'discipulador',
      iniciar, salir, recargarCatalogos
    };
  }, [st, iniciar, salir, recargarCatalogos]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useSesion = () => useContext(Ctx);
