const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { inicializarBaseDeDatos } = require("./database/db");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }, 
});

app.use(cors());
app.use(express.json());

const streamRoutes = require("./routes/stream")(io);
app.use("/api/stream", streamRoutes);

const canalesRoutes = require("./routes/canales");
app.use("/api/canales", canalesRoutes);

const mptsRoutes = require("./routes/mpts")(io);
app.use("/api/mpts", mptsRoutes);

io.on("connection", (socket) => {
  console.log("Cliente conectado:", socket.id);

  socket.on("disconnect", () => {
    console.log("Cliente desconectado:", socket.id);
  });
});

const PUERTO = process.env.PORT || 4000;

inicializarBaseDeDatos()
  .then(() => {
    server.listen(PUERTO, () => {
      console.log(`Servidor escuchando en http://localhost:${PUERTO}`);
    });
  })
  .catch((err) => {
    console.error("Error al conectar con la base de datos:", err.message);
  });