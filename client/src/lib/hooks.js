import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Ejecuta una carga asíncrona y vuelve a ejecutarla cuando cambian las dependencias.
 * Devuelve { datos, error, cargando, recargar }. Mantiene los datos anteriores mientras recarga
 * (la pantalla no "parpadea") e ignora respuestas que llegan tarde.
 */
export function useCarga(fn, deps = []) {
  const [st, setSt] = useState({ datos: null, error: null, cargando: true });
  const [version, setVersion] = useState(0);
  const fnRef = useRef(fn); fnRef.current = fn;
  useEffect(() => {
    let vigente = true;
    setSt(s => ({ ...s, cargando: true }));
    fnRef.current().then(
      datos => { if (vigente) setSt({ datos, error: null, cargando: false }); },
      error => { if (vigente) setSt(s => ({ datos: s.datos, error, cargando: false })); }
    );
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);
  const recargar = useCallback(() => setVersion(v => v + 1), []);
  return { ...st, recargar };
}

/** Devuelve el valor con retraso (para no consultar al servidor en cada tecla). */
export function useRetardo(valor, ms = 300) {
  const [v, setV] = useState(valor);
  useEffect(() => { const t = setTimeout(() => setV(valor), ms); return () => clearTimeout(t); }, [valor, ms]);
  return v;
}

/** Cambia el título de la pestaña del navegador. */
export function useTitulo(titulo) {
  useEffect(() => { if (titulo) document.title = titulo; }, [titulo]);
}
