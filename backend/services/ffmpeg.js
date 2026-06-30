const { spawn } = require("child_process");

const procesosActivos = {};

function construirEntrada(protocolo, urlEntrada) {
  const protocolosValidos = ["UDP", "SRT", "FILE", "RTMP", "RTSP", "HTTP"];
  if (!protocolosValidos.includes(protocolo)) {
    throw new Error("Protocolo no soportado: " + protocolo);
  }
  return urlEntrada;
}

function iniciarStream(datos, onLog, onClose) {
  const { id, protocolo, urlEntrada, ipMulticast, puerto } = datos;

  if (procesosActivos[id]) {
    throw new Error("Ya existe una transmisión activa con este id");
  }

  const entrada = construirEntrada(protocolo, urlEntrada);
  const salida = `udp://${ipMulticast}:${puerto}?pkt_size=1316`;

  const args = ["-i", entrada, "-c", "copy", "-f", "mpegts", salida];

  onLog(`Comando ejecutado: ffmpeg ${args.join(" ")}`);

  const proceso = spawn("ffmpeg", args);
  procesosActivos[id] = proceso;

  proceso.stderr.on("data", (chunk) => {
    onLog(chunk.toString());
  });

  proceso.on("close", (code) => {
    delete procesosActivos[id];
    onClose(code);
  });

  proceso.on("error", (err) => {
    onLog(`Error al ejecutar FFmpeg: ${err.message}`);
  });

  return proceso;
}

function detenerStream(id) {
  const proceso = procesosActivos[id];
  if (!proceso) return false;
  proceso.kill("SIGINT");
  delete procesosActivos[id];
  return true;
}

function listarStreamsActivos() {
  return Object.keys(procesosActivos);
}

module.exports = { iniciarStream, detenerStream, listarStreamsActivos };