# BETEL · Misión Cristiana El Calvario

Sistema de gestión (BETEL) y sitio web público de la Misión Cristiana El Calvario – sede Villavicencio, Colombia.

- **Sitio web público:** `http://localhost:3000/`
- **Sistema BETEL (usuarios internos):** `http://localhost:3000/sistema`
- **Registro de asistencia por QR:** `http://localhost:3000/a/<código>`
- **Base de datos:** MySQL 8 (se administra con MySQL Workbench)
- **Servidor:** Node.js 18 o superior (Express 5)
- **Interfaz:** React 18 + React Router, compilada con Vite

## Estructura del proyecto

```
client/                     Interfaz en React (se compila a dist/)
  index.html
  src/
    main.jsx                Rutas principales: /, /a/:token, /sistema/*
    base.css                Colores y estilos comunes
    lib/                    api.js (llamadas al servidor), formato.js (fechas), constantes.js, hooks.js
    components/             Avisos (mensajes), Modal (ventanas), ui.jsx (campos, tablas, etiquetas)
    sitio/                  Sitio web público
    asistir/                Página que abre el código QR
    sistema/                Sistema BETEL
      SistemaApp.jsx        Login, menú lateral y páginas
      sesion.jsx            Usuario conectado, permisos y catálogos
      rutas.js              Menú y permisos de cada página
      paginas/              Panel, Discípulos, Grupos, Asistencia, Alertas, Eventos, Reportes,
                            Jerarquía, Sedes y horarios, Usuarios, Bitácora, Mi cuenta
src/                        Servidor Express (API en /api)
  routes/discipulos.js      Discípulos (antes "miembros")
public/img, public/uploads  Imágenes del sitio y fotos subidas de eventos
database/betel_schema.sql   Esquema de la base de datos
dist/                       Interfaz compilada (se genera con npm run build; no se edita)
```

Optimización incluida: cada área (sitio, sistema, QR) y cada página del sistema se descarga solo cuando se abre;
React se guarda en caché aparte; el servidor comprime las respuestas y guarda en caché los archivos compilados;
las consultas del panel y de cada ficha se ejecutan en paralelo.

## Instalación

### 1. Base de datos (MySQL Workbench)
1. Abra MySQL Workbench y conéctese a su servidor local.
2. `File > Open SQL Script…` y elija `database/betel_schema.sql`.
3. Ejecute todo el script (icono del rayo). Se crea la base `betel` con sus 19 tablas y los datos iniciales (roles, jerarquía pastoral, horarios y sedes).
4. En una pestaña nueva cree el usuario de la aplicación (cambie la clave):
   ```sql
   CREATE USER 'betel'@'localhost' IDENTIFIED BY 'una_clave_segura';
   GRANT ALL PRIVILEGES ON betel.* TO 'betel'@'localhost';
   FLUSH PRIVILEGES;
   ```
5. Para ver el modelo gráfico: `Database > Reverse Engineer…` y seleccione la base `betel`.

> En la base de datos la tabla de discípulos se sigue llamando `miembros` (y las columnas `miembro_id`), para no perder
> datos existentes. En toda la interfaz, la API y los reportes se muestran como **discípulos**.

### 2. Servidor e interfaz
```bash
npm install
cp .env.example .env        # en Windows: copy .env.example .env
# edite .env con la clave del usuario "betel" y un JWT_SECRET largo y aleatorio
npm run crear-admin -- "Nombre Apellido" correo@ejemplo.com ClaveSegura123
npm run build               # compila la interfaz React en dist/
npm start
```
Abra `http://localhost:3000/sistema` e ingrese con el administrador creado.
Si publica el sistema con HTTPS, agregue `COOKIE_SECURE=true` en `.env`.
Cada vez que cambie algo dentro de `client/`, vuelva a ejecutar `npm run build`.

### Modo desarrollo (cambios en vivo)
```bash
npm run dev         # arranca la API (puerto 3000) y la interfaz React (http://localhost:5173) juntas
```
También existen `npm run dev:api` y `npm run dev:web` para arrancar cada parte por separado.

> En Windows, si PowerShell muestra "la ejecución de scripts está deshabilitada", use `npm.cmd run dev`
> o ejecute una vez `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

## Base de datos en la nube (Aiven)
La base de datos de producción está en **Aiven for MySQL**, que exige conexión SSL.
En `.env` (vea `.env.example`):
```
DB_HOST=<host>.aivencloud.com
DB_PORT=<puerto>
DB_USER=avnadmin
DB_PASSWORD=<contraseña de Aiven>
DB_NAME=betel
DB_SSL=true
DB_SSL_CA_PATH=certs/aiven-ca.pem
```
El certificado CA del proyecto Aiven está en `certs/aiven-ca.pem` (es público; la contraseña **nunca** se sube al repositorio).
En un hosting (Render, Railway, etc.) configure esas mismas variables de entorno; si no puede usar el archivo,
pegue el contenido del certificado en `DB_SSL_CA`. Para trabajar con la base local (XAMPP/MySQL) ponga `DB_SSL=false`.

## Publicación en Vercel (desde GitHub)
El proyecto ya está preparado para Vercel (`vercel.json` + `api/index.js`):
- La interfaz React (`dist/`) la sirve Vercel directamente.
- La API Express corre como función serverless y atiende `/api`, `/img` y `/uploads`.
- Las imágenes de eventos se guardan en la base de datos (tabla `archivos`), porque en Vercel el disco no es permanente.
  Si su base ya existía, ejecute una vez `npm run migrar-archivos`.

Pasos: en vercel.com → **Add New… → Project** → importe el repositorio de GitHub → en **Environment Variables**
agregue las variables de `.env` (DB_*, `DB_SSL=true`, `DB_SSL_CA_PATH=certs/aiven-ca.pem`, `JWT_SECRET`,
`COOKIE_SECURE=true` y `BASE_URL=https://<su-proyecto>.vercel.app`) → **Deploy**.
Cada `git push` a `main` vuelve a publicar automáticamente.

## Asistencia con código QR
- En **Asistencia** elija la eucaristía/reunión y la fecha y pulse **Generar código QR** (o el botón **QR** de cualquier registro reciente).
- Cada lista (eucaristía + día) tiene su **propio código único**; solo funciona ese día (hora de Colombia). Se puede copiar el enlace, descargar en PNG, imprimir o **regenerar** (Pastor, Admin y Asistencia Pastoral) si se filtró.
- El discípulo escanea, escribe su número de identificación y queda **presente** (marca “QR” en la lista). Los visitantes escriben su nombre. En grupos de comunión solo pueden marcar sus discípulos.
- Configure `BASE_URL` en `.env` con la dirección que abren los celulares (no `localhost`).
- Si ya tenía la base de datos creada, ejecute una vez: `npm install` y `npm run migrar-qr`.

## Informes por eucaristía
En **Reportes > Asistencia** puede elegir **Eucaristía / reunión** (más fechas, tipo, etc.) y descargar PDF o Excel; el informe incluye resumen de presentes/ausentes y si el registro fue por QR o manual. También hay botones **Informe PDF/Excel** dentro de cada lista para descargar solo ese día.

## Roles y permisos (según la reunión con el equipo administrador)

| Acción | Admin / Pastor | Asist. Pastoral | Discipulador | Multimedia |
|---|---|---|---|---|
| Ver documento, teléfono, dirección, fecha de nacimiento | Sí | Sí | Solo discípulos de sus grupos | No |
| Nota confidencial (solo pastor principal) | Sí | No | No | No |
| Crear/editar discípulos y cambiar estado (activo/inactivo/retirado) | Sí | Sí | No | No |
| Crear/editar grupos de comunión | Sí | Sí | Sí (solo los suyos) | No |
| Publicar eventos | Sí | No | No | Sí |
| Registrar asistencia | Sí | Sí | Sus grupos | Sí |
| Corregir asistencia ya registrada | Sí | Sí | No | No |
| Ver alertas de 2 faltas consecutivas | Sí | Sí | No | No |
| Estadísticas | Sí | Sí | No | Sí |
| Reportes PDF / Excel | Todos | Todos | Asistencia y grupos de sus grupos | Todos |
| Eliminar registros | Sí | Sí | No | Sí |
| Usuarios, sedes, horarios, ministerios, bitácora | Sí | No | No | No |

## Reglas de negocio implementadas
- Campos obligatorios del discípulo: nombre, identificación, celular y fecha de cumpleaños.
- Un discípulo puede estar en varios ministerios y puede cambiar de grupo (se conserva el historial) y de cobertura.
- Cuando un grupo llega al máximo de discípulos se marca **“Listo para nueva iglesia”** y no admite más personas.
- Estados de asistencia: presente, ausente, justificado, visitante. Aplica a cultos, eventos y grupos.
- Dos inasistencias consecutivas generan una alerta para el Pastor y Asistencia Pastoral; se cierra sola si el discípulo vuelve a asistir.
- Un evento cuya fecha cambia queda como *reprogramado*; también puede cancelarse.
- Toda acción importante queda en la bitácora. Las contraseñas se guardan cifradas (bcrypt).

## Datos por completar desde el sistema
Entre a **Sedes y horarios** y complete: dirección, teléfono y correo de la sede Villavicencio, y los datos de la sede principal en Perú y de las demás sedes. Mientras tanto, el sitio web muestra “Por confirmar”.
