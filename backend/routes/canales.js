/**
 * routes/canales.js
 * -------------------
 * CRUD de canales SPTS guardados en la base de datos.
 * Esto es DIFERENTE de "iniciar una transmisión" (eso sigue en
 * routes/stream.js). Aquí solo se guarda/lee/edita/borra la
 * CONFIGURACIÓN de cada canal, para no perderla al cerrar la página.
 */

const express = require("express");
const router = express.Router();
const { pool } = require("../database/db");

// Crear un canal nuevo
router.post("/", async (req, res) => {
  const {
    nombreCanal, protocolo, urlEntrada, modoSrt, latencia, ttlUdp,
    encriptacion, tipoAes, fraseSecreta, tipoSalida, ipMulticast,
    puertoSalida, codecVideo, bitrateVideo, resolucion, fps,
    codecAudio, bitrateAudio, seleccionarAudio,
  } = req.body;

  if (!nombreCanal || !protocolo || !urlEntrada || !tipoSalida || !ipMulticast) {
    return res.status(400).json({ error: "Faltan datos requeridos para guardar el canal" });
  }

  try {
    const resultado = await pool.query(
      `INSERT INTO canales_spts
        (nombre_canal, protocolo, url_entrada, modo_srt, latencia, ttl_udp,
         encriptacion, tipo_aes, frase_secreta, tipo_salida, ip_salida,
         puerto_salida, codec_video, bitrate_video, resolucion, fps,
         codec_audio, bitrate_audio, seleccionar_audio)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING *`,
      [
        nombreCanal, protocolo, urlEntrada, modoSrt || null, latencia || null, ttlUdp || null,
        encriptacion || false, tipoAes || null, fraseSecreta || null, tipoSalida, ipMulticast,
        puertoSalida || null, codecVideo || null, bitrateVideo || null, resolucion || null, fps || null,
        codecAudio || null, bitrateAudio || null, seleccionarAudio || null,
      ]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Listar todos los canales guardados
router.get("/", async (req, res) => {
  try {
    const resultado = await pool.query(
      "SELECT * FROM canales_spts ORDER BY fecha_creacion DESC"
    );
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ver un canal específico
router.get("/:id", async (req, res) => {
  try {
    const resultado = await pool.query(
      "SELECT * FROM canales_spts WHERE id = $1",
      [req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: "Canal no encontrado" });
    }

    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar un canal existente
router.put("/:id", async (req, res) => {
  const {
    nombreCanal, protocolo, urlEntrada, modoSrt, latencia, ttlUdp,
    encriptacion, tipoAes, fraseSecreta, tipoSalida, ipMulticast,
    puertoSalida, codecVideo, bitrateVideo, resolucion, fps,
    codecAudio, bitrateAudio, seleccionarAudio,
  } = req.body;

  try {
    const resultado = await pool.query(
      `UPDATE canales_spts SET
        nombre_canal=$1, protocolo=$2, url_entrada=$3, modo_srt=$4, latencia=$5,
        ttl_udp=$6, encriptacion=$7, tipo_aes=$8, frase_secreta=$9, tipo_salida=$10,
        ip_salida=$11, puerto_salida=$12, codec_video=$13, bitrate_video=$14,
        resolucion=$15, fps=$16, codec_audio=$17, bitrate_audio=$18, seleccionar_audio=$19
       WHERE id=$20
       RETURNING *`,
      [
        nombreCanal, protocolo, urlEntrada, modoSrt || null, latencia || null, ttlUdp || null,
        encriptacion || false, tipoAes || null, fraseSecreta || null, tipoSalida, ipMulticast,
        puertoSalida || null, codecVideo || null, bitrateVideo || null, resolucion || null, fps || null,
        codecAudio || null, bitrateAudio || null, seleccionarAudio || null,
        req.params.id,
      ]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: "Canal no encontrado" });
    }

    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar un canal
router.delete("/:id", async (req, res) => {
  try {
    const resultado = await pool.query(
      "DELETE FROM canales_spts WHERE id = $1 RETURNING *",
      [req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: "Canal no encontrado" });
    }

    res.json({ ok: true, mensaje: "Canal eliminado" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;