// Cliente de la API del servidor BETEL
let alExpirar = null;
/** Registra qué hacer cuando la sesión expira (401). */
export const alExpirarSesion = (fn) => { alExpirar = fn; };

async function llamar(metodo, url, cuerpo) {
  const r = await fetch('/api' + url, {
    method: metodo,
    headers: cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    credentials: 'same-origin'
  });
  if (r.status === 401 && !url.startsWith('/auth/')) {
    if (alExpirar) alExpirar();
    throw new Error('Su sesión expiró. Ingrese de nuevo.');
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Ocurrió un error');
  return j;
}

export const api = {
  get: (url) => llamar('GET', url),
  post: (url, cuerpo) => llamar('POST', url, cuerpo ?? {}),
  put: (url, cuerpo) => llamar('PUT', url, cuerpo ?? {}),
  patch: (url, cuerpo) => llamar('PATCH', url, cuerpo ?? {}),
  del: (url) => llamar('DELETE', url)
};

/** Sube un archivo (multipart) y devuelve el JSON de respuesta. */
export async function subirArchivo(url, campo, archivo) {
  const fd = new FormData(); fd.append(campo, archivo);
  const r = await fetch('/api' + url, { method: 'POST', body: fd, credentials: 'same-origin' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'No se pudo subir el archivo');
  return j;
}

/** Guarda un Blob como archivo en el equipo. */
export function guardarBlob(blob, nombre) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nombre; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Descarga un reporte (PDF / Excel). Lanza error con el mensaje del servidor si falla. */
export async function descargar(url) {
  const r = await fetch(url, { credentials: 'same-origin' });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'No se pudo generar el reporte'); }
  const n = (r.headers.get('content-disposition') || '').match(/filename="(.+?)"/);
  guardarBlob(await r.blob(), n ? n[1] : 'reporte');
}

/** Lee todos los campos de un formulario (las casillas de verificación como true/false). */
export function leerForm(form) {
  const d = {};
  for (const i of form.elements) {
    if (!i.name || i.disabled) continue;
    if (i.type === 'checkbox') d[i.name] = i.checked;
    else if (i.type === 'radio') { if (i.checked) d[i.name] = i.value; }
    else if (i.type !== 'file' && i.tagName !== 'BUTTON') d[i.name] = i.value;
  }
  return d;
}
