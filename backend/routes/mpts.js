/**
 * routes/mpts.js
 * ----------------
 * CRUD de grupos MPTS (qué canales guardados se agrupan y a dónde
 * sale el flujo combinado), más los endpoints para iniciar y
 * detener el proceso de FFmpeg que realmente combina los canales.
 */

const express = require("express");
const router = express.Router();
const { pool } = require("../database/db");
const ffmpegService = require("../services/ffmpeg");

module.exports = function (io) {
  // Crear un grupo MPTS nuevo: nombre, salida, y la lista de ids de canales que incluye
  router.post("/", async (req, res) => {
    const { nombreGrupo, ipSalida, puertoSalida, canalesIds } = req.body;

    if (!nombreGrupo || !ipSalida || !puertoSalida || !canalesIds?.length) {
      return res.status(400).json({ error: "Faltan datos requeridos (nombre, salida o canales)" });
    }

    const cliente = await pool.connect();
    try {
      await cliente.query("BEGIN");

      const grupoResultado = await cliente.query(
        `INSERT INTO grupos_mpts (nombre_grupo, ip_salida_mpts, puerto_salida_mpts)
         VALUES ($1, $2, $3) RETURNING *`,
        [nombreGrupo, ipSalida, puertoSalida]
      );
      const grupo = grupoResultado.rows[0];

      // Guardamos la relación de cada canal con este grupo, en el orden
      // en que fueron seleccionados (eso define el numero_programa)
      for (let i = 0; i < canalesIds.length; i++) {
        await cliente.query(
          `INSERT INTO mpts_canales (grupo_mpts_id, canal_spts_id, numero_programa)
           VALUES ($1, $2, $3)`,
          [grupo.id, canalesIds[i], i + 1]
        );
      }

      await cliente.query("COMMIT");
      res.status(201).json(grupo);
    } catch (err) {
      await cliente.query("ROLLBACK");
      res.status(500).json({ error: err.message });
    } finally {
      cliente.release();
    }
  });

  // Listar todos los grupos MPTS, junto con los canales que contiene cada uno
  router.get("/", async (req, res) => {
    try {
      const grupos = await pool.query("SELECT * FROM grupos_mpts ORDER BY fecha_creacion DESC");

      // Para cada grupo, traemos sus canales asociados
      const gruposConCanales = await Promise.all(
        grupos.rows.map(async (grupo) => {
          const canales = await pool.query(
            `SELECT c.*, mc.numero_programa
             FROM mpts_canales mc
             JOIN canales_spts c ON c.id = mc.canal_spts_id
             WHERE mc.grupo_mpts_id = $1
             ORDER BY mc.numero_programa ASC`,
            [grupo.id]
          );
          return { ...grupo, canales: canales.rows };
        })
      );

      res.json(gruposConCanales);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Eliminar un grupo MPTS (borra tambien sus relaciones por el ON DELETE CASCADE)
  router.delete("/:id", async (req, res) => {
    try {
      const resultado = await pool.query(
        "DELETE FROM grupos_mpts WHERE id = $1 RETURNING *",
        [req.params.id]
      );

      if (resultado.rows.length === 0) {
        return res.status(404).json({ error: "Grupo no encontrado" });
      }

      res.json({ ok: true, mensaje: "Grupo MPTS eliminado" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Iniciar la transmisión combinada de un grupo MPTS
  router.post("/:id/iniciar", async (req, res) => {
    const grupoId = req.params.id;

    try {
      const grupoResultado = await pool.query("SELECT * FROM grupos_mpts WHERE id = $1", [grupoId]);
      if (grupoResultado.rows.length === 0) {
        return res.status(404).json({ error: "Grupo no encontrado" });
      }
      const grupo = grupoResultado.rows[0];

      const canalesResultado = await pool.query(
        `SELECT c.* FROM mpts_canales mc
         JOIN canales_spts c ON c.id = mc.canal_spts_id
         WHERE mc.grupo_mpts_id = $1
         ORDER BY mc.numero_programa ASC`,
        [grupoId]
      );

      ffmpegService.iniciarMpts(
        {
          grupoId,
          canales: canalesResultado.rows,
          ipSalida: grupo.ip_salida_mpts,
          puertoSalida: grupo.puerto_salida_mpts,
        },
        (mensaje) => {
          io.emit("mptsLog", { grupoId, mensaje });
        },
        (codigoSalida) => {
          io.emit("mptsEstado", { grupoId, estado: "detenido", codigoSalida });
        }
      );

      io.emit("mptsEstado", { grupoId, estado: "transmitiendo" });
      res.json({ ok: true, mensaje: "MPTS iniciado", grupoId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Detener la transmisión combinada de un grupo MPTS
  router.post("/:id/detener", (req, res) => {
    const grupoId = req.params.id;
    const detenido = ffmpegService.detenerMpts(grupoId);

    if (detenido) {
      io.emit("mptsEstado", { grupoId, estado: "detenido" });
      res.json({ ok: true, mensaje: "MPTS detenido" });
    } else {
      res.status(404).json({ error: "No hay un MPTS activo con ese id" });
    }
  });

  // Listar los grupos MPTS actualmente en transmisión
  router.get("/activos/lista", (req, res) => {
    res.json({ activos: ffmpegService.listarMptsActivos() });
  });

  return router;
};