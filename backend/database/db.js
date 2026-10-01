const { Pool } = require("pg");

const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "1234",
  database: "stream_manager",
});

async function inicializarBaseDeDatos() {
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS grupos_mpts (
      id SERIAL PRIMARY KEY,
      nombre_grupo TEXT NOT NULL,
      tipo_salida_mpts TEXT NOT NULL DEFAULT 'UDP',
      ip_salida_mpts TEXT NOT NULL,
      puerto_salida_mpts TEXT NOT NULL,
      fecha_creacion TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE grupos_mpts
    ADD COLUMN IF NOT EXISTS tipo_salida_mpts TEXT NOT NULL DEFAULT 'UDP';
  `);

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