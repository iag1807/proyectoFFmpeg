/**
 * server.js
 * ---------
 * Punto de entrada del backend.
 * Levanta el servidor Express, configura Socket.io para los logs
 * en tiempo real, y conecta las rutas de streaming.
 */

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { inicializarBaseDeDatos } = require("./database/db");

const app = express();
const server = http.createServer(app);

// Socket.io permite mandar mensajes en tiempo real al navegador
// (lo usamos para mostrar los logs de ffmpeg mientras transmite)
const io = new Server(server, {
  cors: { origin: "*" }, // en producción aquí va el dominio real del frontend
});

app.use(cors());
app.use(express.json());

// Sirve los archivos .m3u8 y .ts de cada canal como archivos estáticos normales,
// para que el navegador (con hls.js) pueda pedirlos por HTTP.
// Ej: http://localhost:4000/streams/canal-123/index.m3u8
const ffmpegService = require("./services/ffmpeg");
app.use("/streams", express.static(ffmpegService.CARPETA_STREAMS));

// Rutas de la API, le pasamos "io" para poder emitir eventos desde ahí
const streamRoutes = require("./routes/stream")(io);
app.use("/api/stream", streamRoutes);

// Rutas para guardar/listar/editar/eliminar canales (CRUD, sin ejecutar ffmpeg)
const canalesRoutes = require("./routes/canales");
app.use("/api/canales", canalesRoutes);

io.on("connection", (socket) => {
  console.log("Cliente conectado:", socket.id);

  socket.on("disconnect", () => {
    console.log("Cliente desconectado:", socket.id);
  });
});

const PUERTO = process.env.PORT || 4000;

// Primero verificamos/creamos las tablas, y solo despues levantamos el servidor
inicializarBaseDeDatos()
  .then(() => {
    server.listen(PUERTO, () => {
      console.log(`Servidor escuchando en http://localhost:${PUERTO}`);
    });
  })
  .catch((err) => {
    console.error("Error al conectar con la base de datos:", err.message);
  });