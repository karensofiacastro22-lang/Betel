-- =====================================================================
--  BETEL - Sistema Integral de Gestión e Información para Iglesias
--  Misión Cristiana El Calvario
--  Base de datos MySQL 8.x  (abrir y ejecutar completo en MySQL Workbench)
--  Menú: File > Open SQL Script... > betel_schema.sql > rayo (Execute)
-- =====================================================================

SET NAMES utf8mb4;
DROP DATABASE IF EXISTS betel;
CREATE DATABASE betel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE betel;

-- ---------------------------------------------------------------------
-- 1. SEDES
-- ---------------------------------------------------------------------
CREATE TABLE sedes (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL,
  ciudad        VARCHAR(80),
  pais          VARCHAR(80)  NOT NULL,
  direccion     VARCHAR(200),
  telefono      VARCHAR(30),
  correo        VARCHAR(120),
  descripcion   VARCHAR(500),
  es_principal  TINYINT(1) NOT NULL DEFAULT 0,   -- sede principal de la misión
  es_local      TINYINT(1) NOT NULL DEFAULT 0,   -- sede donde opera este sistema
  activa        TINYINT(1) NOT NULL DEFAULT 1,
  creado_en     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. ROLES Y USUARIOS DEL SISTEMA
-- ---------------------------------------------------------------------
CREATE TABLE roles (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  codigo      VARCHAR(30) NOT NULL UNIQUE,
  nombre      VARCHAR(60) NOT NULL,
  descripcion VARCHAR(255)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. JERARQUÍA PASTORAL (estructura real según reunión)
-- ---------------------------------------------------------------------
CREATE TABLE niveles_jerarquia (
  id     INT AUTO_INCREMENT PRIMARY KEY,
  orden  INT NOT NULL UNIQUE,        -- 1 = más alto
  nombre VARCHAR(80) NOT NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. MIEMBROS
-- ---------------------------------------------------------------------
CREATE TABLE miembros (
  id                        INT AUTO_INCREMENT PRIMARY KEY,
  nombres                   VARCHAR(100) NOT NULL,
  apellidos                 VARCHAR(100) NOT NULL,
  tipo_identificacion       ENUM('CC','TI','CE','PAS','RC','PPT','OTRO') NOT NULL DEFAULT 'CC',
  numero_identificacion     VARCHAR(30)  NOT NULL,
  celular                   VARCHAR(25)  NULL,             -- NULL si se registró solo por QR (el equipo lo completa)
  correo                    VARCHAR(120),
  direccion                 VARCHAR(200),
  grupo_sanguineo           ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-'),
  eps                       VARCHAR(80),
  fecha_nacimiento          DATE NULL,                     -- fecha de cumpleaños (NULL si se registró solo por QR)
  nivel_jerarquia_id        INT NULL,                      -- función en la iglesia (si tiene cargo)
  funcion_iglesia           VARCHAR(100),                  -- función libre (ej. Multimedia, Alabanza)
  sede_id                   INT NOT NULL,
  supervisor_id             INT NULL,                      -- cobertura (quién lo supervisa)
  contacto_emergencia       VARCHAR(120),
  celular_emergencia        VARCHAR(25),
  estado                    ENUM('activo','inactivo','retirado') NOT NULL DEFAULT 'activo',
  nota_confidencial         TEXT NULL,                     -- solo pastor / administrador
  autoriza_datos            TINYINT(1) NOT NULL DEFAULT 0, -- Ley 1581 de 2012
  fecha_autorizacion        DATE NULL,
  medio_autorizacion        ENUM('papel','digital','ambos') NULL,
  creado_en                 TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_miembro_doc (tipo_identificacion, numero_identificacion),
  KEY ix_miembro_estado (estado),
  KEY ix_miembro_cumple (fecha_nacimiento),
  CONSTRAINT fk_miembro_sede  FOREIGN KEY (sede_id) REFERENCES sedes(id),
  CONSTRAINT fk_miembro_nivel FOREIGN KEY (nivel_jerarquia_id) REFERENCES niveles_jerarquia(id) ON DELETE SET NULL,
  CONSTRAINT fk_miembro_sup   FOREIGN KEY (supervisor_id) REFERENCES miembros(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- historial de cambios de cobertura (un miembro puede cambiar de cobertura)
CREATE TABLE historial_cobertura (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  miembro_id        INT NOT NULL,
  supervisor_anterior_id INT NULL,
  supervisor_nuevo_id    INT NULL,
  fecha             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hc_miembro FOREIGN KEY (miembro_id) REFERENCES miembros(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE usuarios (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL,
  correo        VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  rol_id        INT NOT NULL,
  miembro_id    INT NULL,                -- el usuario puede estar vinculado a un miembro (discipulador)
  activo        TINYINT(1) NOT NULL DEFAULT 1,
  ultimo_acceso DATETIME NULL,
  creado_en     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_usr_rol     FOREIGN KEY (rol_id) REFERENCES roles(id),
  CONSTRAINT fk_usr_miembro FOREIGN KEY (miembro_id) REFERENCES miembros(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. MINISTERIOS (un miembro puede pertenecer a más de uno)
-- ---------------------------------------------------------------------
CREATE TABLE ministerios (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL UNIQUE,
  descripcion VARCHAR(300),
  activo      TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE miembro_ministerio (
  miembro_id    INT NOT NULL,
  ministerio_id INT NOT NULL,
  desde         DATE NULL,
  PRIMARY KEY (miembro_id, ministerio_id),
  CONSTRAINT fk_mm_miembro FOREIGN KEY (miembro_id) REFERENCES miembros(id) ON DELETE CASCADE,
  CONSTRAINT fk_mm_min     FOREIGN KEY (ministerio_id) REFERENCES ministerios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. FORMACIÓN (discipulado / adiestramiento)
-- ---------------------------------------------------------------------
CREATE TABLE programas_formacion (
  id     INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE miembro_formacion (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  miembro_id    INT NOT NULL,
  programa_id   INT NOT NULL,
  nivel         VARCHAR(80),             -- libro / etapa actual
  estado        ENUM('en_curso','completado','suspendido') NOT NULL DEFAULT 'en_curso',
  fecha_inicio  DATE NULL,
  fecha_fin     DATE NULL,
  CONSTRAINT fk_mf_miembro  FOREIGN KEY (miembro_id)  REFERENCES miembros(id) ON DELETE CASCADE,
  CONSTRAINT fk_mf_programa FOREIGN KEY (programa_id) REFERENCES programas_formacion(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. GRUPOS DE COMUNIÓN FAMILIAR
-- ---------------------------------------------------------------------
CREATE TABLE grupos_comunion (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  nombre             VARCHAR(100) NOT NULL,
  discipulador_id    INT NULL,                       -- miembro responsable
  sede_id            INT NOT NULL,
  dia_reunion        VARCHAR(20),
  hora_reunion       TIME NULL,
  lugar              VARCHAR(200),
  max_integrantes    INT NOT NULL DEFAULT 12,
  estado             ENUM('activo','listo_nueva_iglesia','inactivo') NOT NULL DEFAULT 'activo',
  creado_por         INT NULL,
  creado_en          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gc_disc FOREIGN KEY (discipulador_id) REFERENCES miembros(id) ON DELETE SET NULL,
  CONSTRAINT fk_gc_sede FOREIGN KEY (sede_id) REFERENCES sedes(id),
  CONSTRAINT fk_gc_user FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- un miembro puede cambiar de grupo: se conserva el historial
CREATE TABLE grupo_miembro (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  grupo_id      INT NOT NULL,
  miembro_id    INT NOT NULL,
  fecha_ingreso DATE NOT NULL,
  fecha_salida  DATE NULL,
  CONSTRAINT fk_gm_grupo   FOREIGN KEY (grupo_id)   REFERENCES grupos_comunion(id) ON DELETE CASCADE,
  CONSTRAINT fk_gm_miembro FOREIGN KEY (miembro_id) REFERENCES miembros(id) ON DELETE CASCADE,
  KEY ix_gm_activo (grupo_id, fecha_salida)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 8. CULTOS (horarios fijos) Y EVENTOS
-- ---------------------------------------------------------------------
CREATE TABLE horarios_culto (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  sede_id     INT NOT NULL,
  nombre      VARCHAR(100) NOT NULL,
  dia_semana  TINYINT NOT NULL,                    -- 0=Domingo ... 6=Sábado
  hora        TIME NOT NULL,
  modalidad   ENUM('presencial','virtual','mixta') NOT NULL DEFAULT 'presencial',
  plataforma  VARCHAR(100),                        -- Zoom, YouTube, Facebook
  activo      TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_hc_sede FOREIGN KEY (sede_id) REFERENCES sedes(id)
) ENGINE=InnoDB;

CREATE TABLE eventos (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  sede_id             INT NOT NULL,
  titulo              VARCHAR(150) NOT NULL,
  tipo                ENUM('culto','especial') NOT NULL DEFAULT 'especial',
  descripcion         TEXT,
  fecha               DATE NOT NULL,
  hora                TIME NOT NULL,
  lugar               VARCHAR(200),
  imagen              VARCHAR(255),
  modalidad           ENUM('presencial','virtual','mixta') NOT NULL DEFAULT 'presencial',
  url_transmision     VARCHAR(255),
  requiere_inscripcion TINYINT(1) NOT NULL DEFAULT 0,
  estado              ENUM('programado','cancelado','reprogramado') NOT NULL DEFAULT 'programado',
  fecha_original      DATE NULL,
  publicado           TINYINT(1) NOT NULL DEFAULT 1,
  publicado_por       INT NULL,
  creado_en           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_evento_fecha (fecha),
  CONSTRAINT fk_ev_sede FOREIGN KEY (sede_id) REFERENCES sedes(id),
  CONSTRAINT fk_ev_user FOREIGN KEY (publicado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE inscripciones_evento (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  evento_id   INT NOT NULL,
  nombre      VARCHAR(150) NOT NULL,
  celular     VARCHAR(25)  NOT NULL,
  correo      VARCHAR(120),
  miembro_id  INT NULL,
  creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ie_evento  FOREIGN KEY (evento_id)  REFERENCES eventos(id) ON DELETE CASCADE,
  CONSTRAINT fk_ie_miembro FOREIGN KEY (miembro_id) REFERENCES miembros(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 9. ASISTENCIA
-- ---------------------------------------------------------------------
CREATE TABLE sesiones_asistencia (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tipo        ENUM('culto','evento','grupo') NOT NULL,
  nombre      VARCHAR(150) NOT NULL,
  fecha       DATE NOT NULL,
  sede_id     INT NOT NULL,
  horario_id  INT NULL,
  evento_id   INT NULL,
  grupo_id    INT NULL,
  creado_por  INT NULL,
  creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  token_qr    VARCHAR(48) NULL,                    -- código único de esta eucaristía/reunión en este día (va dentro del QR)
  KEY ix_ses_fecha (fecha),
  UNIQUE KEY uq_ses_token (token_qr),
  CONSTRAINT fk_sa_sede    FOREIGN KEY (sede_id)    REFERENCES sedes(id),
  CONSTRAINT fk_sa_horario FOREIGN KEY (horario_id) REFERENCES horarios_culto(id) ON DELETE SET NULL,
  CONSTRAINT fk_sa_evento  FOREIGN KEY (evento_id)  REFERENCES eventos(id) ON DELETE SET NULL,
  CONSTRAINT fk_sa_grupo   FOREIGN KEY (grupo_id)   REFERENCES grupos_comunion(id) ON DELETE SET NULL,
  CONSTRAINT fk_sa_user    FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE asistencias (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  sesion_id        INT NOT NULL,
  miembro_id       INT NULL,                       -- NULL cuando es visitante
  visitante_nombre VARCHAR(150) NULL,
  estado           ENUM('presente','ausente','justificado','visitante') NOT NULL,
  observacion      VARCHAR(255),
  registrado_por   INT NULL,
  corregido_por    INT NULL,
  corregido_en     DATETIME NULL,
  origen           ENUM('manual','qr') NOT NULL DEFAULT 'manual',   -- 'qr' = el miembro marcó su propia asistencia
  creado_en        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_asis (sesion_id, miembro_id),
  CONSTRAINT fk_as_sesion  FOREIGN KEY (sesion_id)  REFERENCES sesiones_asistencia(id) ON DELETE CASCADE,
  CONSTRAINT fk_as_miembro FOREIGN KEY (miembro_id) REFERENCES miembros(id) ON DELETE CASCADE,
  CONSTRAINT fk_as_reg     FOREIGN KEY (registrado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_as_cor     FOREIGN KEY (corregido_por)  REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 10. ALERTAS DE INASISTENCIA (2 faltas consecutivas)
-- ---------------------------------------------------------------------
CREATE TABLE alertas_inasistencia (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  miembro_id         INT NOT NULL,
  tipo_sesion        ENUM('culto','evento','grupo') NOT NULL,
  grupo_id           INT NULL,
  faltas_consecutivas INT NOT NULL,
  ultima_fecha       DATE NOT NULL,
  estado             ENUM('pendiente','atendida') NOT NULL DEFAULT 'pendiente',
  nota_seguimiento   VARCHAR(500),
  atendida_por       INT NULL,
  atendida_en        DATETIME NULL,
  creado_en          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_al_miembro FOREIGN KEY (miembro_id) REFERENCES miembros(id) ON DELETE CASCADE,
  CONSTRAINT fk_al_user    FOREIGN KEY (atendida_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 11. AUDITORÍA
-- ---------------------------------------------------------------------
CREATE TABLE bitacora (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NULL,
  accion     VARCHAR(40) NOT NULL,
  entidad    VARCHAR(60) NOT NULL,
  entidad_id INT NULL,
  detalle    VARCHAR(500),
  ip         VARCHAR(60),
  fecha      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_bit_fecha (fecha)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 12. ARCHIVOS SUBIDOS (imágenes de eventos; se guardan en la base para funcionar en Vercel)
-- ---------------------------------------------------------------------
CREATE TABLE archivos (
  nombre    VARCHAR(40) PRIMARY KEY,        -- ej. 3f9a...c1.webp  (se sirve en /uploads/<nombre>)
  tipo      VARCHAR(40) NOT NULL,           -- image/png, image/jpeg, image/webp
  datos     MEDIUMBLOB NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =====================================================================
--  DATOS INICIALES (catálogos y datos tomados de la reunión)
-- =====================================================================
INSERT INTO roles (codigo, nombre, descripcion) VALUES
 ('administrador','Administrador','Todos los permisos'),
 ('pastor','Pastor','Todos los permisos'),
 ('asistencia_pastoral','Asistencia Pastoral','Gestión de discípulos, grupos, asistencia, reportes y eliminación'),
 ('discipulador','Discipulador','Solo lo relacionado con los grupos de comunión familiar a su cargo'),
 ('multimedia','Multimedia','Publicación de eventos, estadísticas y reportes');

INSERT INTO niveles_jerarquia (orden, nombre) VALUES
 (1,'Apóstol General'),
 (2,'Asistencia Apostólica'),
 (3,'Pastor de Distrito'),
 (4,'Pastor Local'),
 (5,'Asistencia Pastoral'),
 (6,'Discipulador');

INSERT INTO programas_formacion (nombre) VALUES ('Discipulado'),('Adiestramiento');

INSERT INTO ministerios (nombre) VALUES ('Multimedia'),('Alabanza'),('Intercesión'),('Niños'),('Jóvenes');

-- Sedes. Solo se cargan los datos confirmados; el resto se completa desde el sistema.
INSERT INTO sedes (nombre, ciudad, pais, descripcion, es_principal, es_local) VALUES
 ('Misión Cristiana El Calvario Villavicencio','Villavicencio','Colombia',
  NULL,0,1),
 ('Misión Cristiana El Calvario - Sede principal',NULL,'Perú',
  NULL,1,0);

INSERT INTO horarios_culto (sede_id, nombre, dia_semana, hora, modalidad, plataforma) VALUES
 (1,'Servicio General',0,'09:00:00','mixta','YouTube y Facebook'),
 (1,'Discipulado (primer turno)',1,'19:30:00','virtual','Zoom'),
 (1,'Discipulado (segundo turno)',1,'20:30:00','virtual','Zoom'),
 (1,'Adiestramiento',4,'19:30:00','mixta','Zoom');
