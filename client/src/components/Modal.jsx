import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// Ventana modal única del sistema. Uso:
//   const modal = useModal();
//   modal.abrir('Título', <Componente ... />, 'min(820px,95vw)');
//   modal.cerrar();
const Ctx = createContext(null);
let clave = 1;

export function ModalProvider({ children }) {
  const [m, setM] = useState(null);
  const ref = useRef(null);

  const abrir = useCallback((titulo, contenido, ancho) => setM({ titulo, contenido, ancho, clave: clave++ }), []);
  const cerrar = useCallback(() => setM(null), []);

  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (m && !d.open) d.showModal();
    if (!m && d.open) d.close();
  }, [m]);

  useEffect(() => {
    const d = ref.current;
    const alCerrar = () => setM(null);           // tecla Esc o cierre del navegador
    d.addEventListener('close', alCerrar);
    return () => d.removeEventListener('close', alCerrar);
  }, []);

  const valor = useMemo(() => ({ abrir, cerrar }), [abrir, cerrar]);
  return (
    <Ctx.Provider value={valor}>
      {children}
      <dialog ref={ref} className="modal" style={{ width: m?.ancho || undefined }}>
        {m && <>
          <div className="m-cab"><h3>{m.titulo}</h3><button type="button" onClick={cerrar} aria-label="Cerrar">×</button></div>
          <div className="m-cuerpo" key={m.clave}>{m.contenido}</div>
        </>}
      </dialog>
    </Ctx.Provider>
  );
}

export const useModal = () => useContext(Ctx);

/** Pie estándar de formularios en modal: Cancelar + Guardar (más botones opcionales a la izquierda). */
export function PieForm({ children, textoGuardar = 'Guardar', ocupado }) {
  const { cerrar } = useModal();
  return (
    <div className="m-pie">
      {children}
      <button type="button" className="btn sec" onClick={cerrar}>Cancelar</button>
      <button className="btn" disabled={ocupado}>{ocupado ? 'Guardando…' : textoGuardar}</button>
    </div>
  );
}
