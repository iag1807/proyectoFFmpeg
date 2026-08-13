/**
 * database/db.js
 * ---------------
 * Conexión a PostgreSQL y creación automática de las tablas
 * que necesita el proyecto (canales SPTS, grupos MPTS, y la
 * relación entre ambos).
 *
 * Por ahora se conecta a un PostgreSQL LOCAL (en tu propio
 * computador). Cuando la empresa te de un servidor real, solo
 * hay que cambiar estos valores de conexión (host, usuario,
 * contraseña) por los que te den ellos.
 */

const { Pool } = require("pg");

const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "2026", 
  database: "stream_manager",
});

/**
 * Crea las tablas si no existen todavía. Se llama una sola vez
 * cuando arranca el servidor (ver server.js).
 */
async function inicializarBaseDeDatos() {
  // Tabla de canales individuales (SPTS)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS canales_spts (
      id SERIAL PRIMARY KEY,
      nombre_canal TEXT NOT NULL,
      protocolo TEXT NOT NULL,
      url_entrada TEXT NOT NULL,
      modo_srt TEXT,
      latencia INTEGER,
      ttl_udp INTEGER,
      encriptacion BOOLEAN DEFAULT FALSE,
      tipo_aes TEXT,
      frase_secreta TEXT,
      tipo_salida TEXT NOT NULL,
      ip_salida TEXT NOT NULL,
      puerto_salida TEXT,
      codec_video TEXT,
      bitrate_video TEXT,
      resolucion TEXT,
      fps TEXT,
      codec_audio TEXT,
      bitrate_audio TEXT,
      seleccionar_audio TEXT,
      fecha_creacion TIMESTAMP DEFAULT NOW()
    );
  `);

  // Tabla de grupos MPTS (varios canales empaquetados en una sola salida)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS grupos_mpts (
      id SERIAL PRIMARY KEY,
      nombre_grupo TEXT NOT NULL,
      ip_salida_mpts TEXT NOT NULL,
      puerto_salida_mpts TEXT NOT NULL,
      fecha_creacion TIMESTAMP DEFAULT NOW()
    );
  `);

  // Tabla intermedia: qué canales pertenecen a qué grupo MPTS
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mpts_canales (
      id SERIAL PRIMARY KEY,
      grupo_mpts_id INTEGER NOT NULL REFERENCES grupos_mpts(id) ON DELETE CASCADE,
      canal_spts_id INTEGER NOT NULL REFERENCES canales_spts(id) ON DELETE CASCADE,
      numero_programa INTEGER NOT NULL
    );
  `);

  console.log("Base de datos verificada/creada correctamente.");
}

module.exports = { pool, inicializarBaseDeDatos };