const express = require("express");
const router = express.Router();
const ffmpegService = require("../services/ffmpeg");

module.exports = function (io) {
  router.post("/iniciar", (req, res) => {
    const { id, protocolo, urlEntrada, ipMulticast, puerto } = req.body;

    if (!id || !protocolo || !urlEntrada || !ipMulticast || !puerto) {
      return res.status(400).json({ error: "Faltan datos requeridos" });
    }

    try {
      ffmpegService.iniciarStream(
        { id, protocolo, urlEntrada, ipMulticast, puerto },
        (mensaje) => {
          io.emit("log", { id, mensaje });
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

  router.get("/activos", (req, res) => {
    res.json({ activos: ffmpegService.listarStreamsActivos() });
  });

  return router;
};