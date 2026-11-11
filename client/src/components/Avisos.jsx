import { createContext, useCallback, useContext, useMemo, useState } from 'react';

// Mensajes emergentes ("toasts") en la esquina inferior derecha
const Ctx = createContext(null);
let siguiente = 1;

export function AvisosProvider({ children }) {
  const [lista, setLista] = useState([]);
  const mostrar = useCallback((texto, error) => {
    const id = siguiente++;
    setLista(l => [...l, { id, texto, error }]);
    setTimeout(() => setLista(l => l.filter(t => t.id !== id)), error ? 6000 : 3500);
  }, []);
  const valor = useMemo(() => ({
    ok: (t) => mostrar(t, false),
    error: (e) => mostrar(e instanceof Error ? e.message : String(e), true)
  }), [mostrar]);
  return (
    <Ctx.Provider value={valor}>
      {children}
      <div id="toasts" aria-live="polite">
        {lista.map(t => <div key={t.id} className={'toast' + (t.error ? ' err' : '')}>{t.texto}</div>)}
      </div>
    </Ctx.Provider>
  );
}

/** aviso.ok('Guardado') / aviso.error(err) */
export const useAviso = () => useContext(Ctx);
