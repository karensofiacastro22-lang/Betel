// Arranca todo el entorno de desarrollo con un solo comando (npm run dev):
//   - API Express (puerto 3000) con reinicio automático al guardar cambios
//   - Interfaz React con Vite (puerto 5173), que reenvía /api, /img y /uploads a la API
// Ctrl+C detiene ambos.
const { spawn } = require('child_process');
const path = require('path');

const raiz = path.join(__dirname, '..');
const viteBin = path.join(raiz, 'node_modules', 'vite', 'bin', 'vite.js');

const procesos = [
  { nombre: 'api', color: '\x1b[36m', args: ['--watch', 'src/server.js'] },
  { nombre: 'web', color: '\x1b[35m', args: [viteBin] }
];

let cerrando = false;
const hijos = procesos.map(({ nombre, color, args }) => {
  const hijo = spawn(process.execPath, args, { cwd: raiz, env: process.env });
  const prefijo = `${color}[${nombre}]\x1b[0m `;
  const salida = (destino) => (datos) => {
    for (const linea of datos.toString().split(/\r?\n/)) {
      if (linea.trim()) destino.write(prefijo + linea + '\n');
    }
  };
  hijo.stdout.on('data', salida(process.stdout));
  hijo.stderr.on('data', salida(process.stderr));
  hijo.on('exit', (codigo) => {
    if (cerrando) return;
    console.error(`${prefijo}se detuvo (código ${codigo}). Cerrando todo...`);
    detener(codigo || 1);
  });
  return hijo;
});

function detener(codigo = 0) {
  if (cerrando) return;
  cerrando = true;
  for (const h of hijos) if (h.exitCode === null) h.kill();
  setTimeout(() => process.exit(codigo), 300);
}

process.on('SIGINT', () => detener(0));
process.on('SIGTERM', () => detener(0));
