/**
 * routes/stream.js
 * ----------------
 * Define los endpoints que el frontend va a usar:
 *   POST /api/stream/iniciar   -> empieza una transmisión
 *   POST /api/stream/detener   -> detiene una transmisión
 *   GET  /api/stream/activos   -> lista los streams corriendo
 */

const express = require("express");
const router = express.Router();
const ffmpegService = require("../services/ffmpeg");
const { parsearLineaProgreso, parsearInfoStream } = require("../services/parserEstadisticas");

// "io" se inyecta desde server.js para poder mandar logs en tiempo real
module.exports = function (io) {
  // Iniciar una transmisión
  router.post("/iniciar", (req, res) => {
    // req.body trae TODOS los campos del formulario avanzado:
    // id, nombreCanal, protocolo, urlEntrada, modoSrt, latencia, ttlUdp,
    // encriptacion, tipoAes, fraseSecreta, tipoSalida, ipMulticast,
    // puertoSalida, codecVideo, bitrateVideo, resolucion, fps,
    // codecAudio, bitrateAudio, seleccionarAudio
    const datos = req.body;
    const { id, protocolo, urlEntrada, ipMulticast, puertoSalida, tipoSalida } = datos;

    // Solo validamos los campos minimos indispensables
    if (!id || !protocolo || !urlEntrada || !ipMulticast || (tipoSalida !== "HLS" && !puertoSalida)) {
      return res.status(400).json({ error: "Faltan datos requeridos" });
    }

    try {
      ffmpegService.iniciarStream(
        datos,
        (mensaje) => {
          // Cada vez que ffmpeg manda una línea de log,
          // se la enviamos al navegador en tiempo real por socket.io
          io.emit("log", { id, mensaje });

          // Además, intentamos extraer datos estructurados de esa línea
          // (frame, fps, bitrate, speed...) para mostrarlos en tarjetas
          const stats = parsearLineaProgreso(mensaje);
          if (stats) {
            io.emit("stats", { id, stats });
          }

          // También detectamos info del stream (codec de video/audio,
          // resolución) que aparece al inicio de la conexión
          const infoStream = parsearInfoStream(mensaje);
          if (infoStream) {
            io.emit("infoStream", { id, infoStream });
          }
        },
        (codigoSalida) => {
          io.emit("estado", { id, estado: "detenido", codigoSalida });
        }
      );

      io.emit("estado", { id, estado: "transmitiendo" });
      res.json({ ok: true, mensaje: "Transmisión iniciada", id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Detener una transmisión
  router.post("/detener", (req, res) => {
    const { id } = req.body;
    const detenido = ffmpegService.detenerStream(id);

    if (detenido) {
      io.emit("estado", { id, estado: "detenido" });
      res.json({ ok: true, mensaje: "Transmisión detenida" });
    } else {
      res.status(404).json({ error: "No se encontró una transmisión activa con ese id" });
    }
  });

  // Listar transmisiones activas
  router.get("/activos", (req, res) => {
    res.json({ activos: ffmpegService.listarStreamsActivos() });
  });

  return router;
};