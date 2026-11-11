import { estadoTxt } from '../lib/formato.js';

export const Badge = ({ estado, children, className = '' }) => (
  <span className={`badge ${estado || ''} ${className}`}>{children ?? estadoTxt(estado)}</span>
);

export const Vacio = ({ children, panel }) => <p className={panel ? 'panel vacio' : 'vacio'}>{children}</p>;

/** Muestra "Cargando…" o el error de un useCarga; si hay datos, ejecuta children(datos). */
export function Cargando({ carga, children }) {
  if (carga.error && !carga.datos) return <Vacio>{carga.error.message}</Vacio>;
  if (!carga.datos) return <Vacio>Cargando…</Vacio>;
  return children(carga.datos);
}

/** Opciones de un <select>: lista de [valor, texto] y opción vacía opcional. */
export const Opciones = ({ lista, vacio }) => <>
  {vacio !== undefined && <option value="">{vacio}</option>}
  {lista.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
</>;

/**
 * Campo de formulario no controlado (se lee al enviar con leerForm).
 * Con `opciones` es un select; con `area` es un textarea; si no, un input.
 */
export function Campo({ label, name, valor, req, tipo = 'text', max, min, full, opciones, vacio, area, ...resto }) {
  const v = valor ?? '';
  return (
    <label className={full ? 'full' : undefined}>
      {label}{req ? ' *' : ''}
      {opciones
        ? <select name={name} required={!!req} defaultValue={v} {...resto}><Opciones lista={opciones} vacio={vacio} /></select>
        : area
          ? <textarea name={name} rows={area} maxLength={max} defaultValue={v} {...resto} />
          : <input name={name} type={tipo} required={!!req} maxLength={max} min={min} defaultValue={v} {...resto} />}
    </label>
  );
}

export const Check = ({ label, name, valor, ...resto }) => (
  <label className="chk"><input type="checkbox" name={name} defaultChecked={!!valor} {...resto} /> {label}</label>
);

export const Tabs = ({ opciones, actual, onCambio }) => (
  <div className="tabs" role="tablist">
    {opciones.map(([k, t]) => (
      <button key={k} type="button" role="tab" aria-selected={actual === k} className={actual === k ? 'act' : ''} onClick={() => onCambio(k)}>{t}</button>
    ))}
  </div>
);

/** Tabla con encabezado negro y desplazamiento horizontal en pantallas pequeñas. */
export const Tabla = ({ columnas, children }) => (
  <div className="tabla-wrap">
    <table>
      <thead><tr>{columnas.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);
