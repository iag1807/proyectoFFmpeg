/**
 * services/ffmpeg.js
 * -------------------
 * Arma y ejecuta los comandos FFmpeg según TODOS los parámetros
 * que el usuario configura en el formulario: entrada, salida,
 * codecs, resolución, audio, encriptación SRT, etc.
 */

const { spawn } = require("child_process");

const procesosActivos = {};

/**
 * Arma el string de entrada (-i) agregando los parámetros
 * específicos de cada protocolo como query params en la URL.
 */
function construirEntrada(datos) {
  const { protocolo, urlEntrada, modoSrt, latencia, ttlUdp, encriptacion, tipoAes, fraseSecreta } = datos;

  const protocolosValidos = ["UDP", "SRT", "FILE", "RTMP", "RTSP", "HTTP"];
  if (!protocolosValidos.includes(protocolo)) {
    throw new Error("Protocolo no soportado: " + protocolo);
  }

  // FILE, HTTP, RTMP y RTSP no llevan parámetros extra, se usan tal cual
  if (protocolo === "FILE" || protocolo === "HTTP" || protocolo === "RTMP" || protocolo === "RTSP") {
    return urlEntrada;
  }

  // Para SRT armamos los query params: modo, latencia, encriptación
  if (protocolo === "SRT") {
    const params = [];
    if (modoSrt) params.push(`mode=${modoSrt}`);
    if (latencia) params.push(`latency=${latencia}`);
    if (encriptacion && fraseSecreta) {
      params.push(`passphrase=${encodeURIComponent(fraseSecreta)}`);
      params.push(`pbkeylen=${tipoAes || 32}`);
    }
    const queryString = params.length ? "?" + params.join("&") : "";
    return `${urlEntrada}${queryString}`;
  }

  // Para UDP armamos el TTL si se especificó
  if (protocolo === "UDP") {
    const params = [];
    if (ttlUdp) params.push(`ttl=${ttlUdp}`);
    const queryString = params.length ? "?" + params.join("&") : "";
    return `${urlEntrada}${queryString}`;
  }

  return urlEntrada;
}

/**
 * Arma los parámetros de video: codec, bitrate, resolución, fps.
 * Si no se especifica codec, usamos "copy" (más rápido, sin recodificar).
 */
function construirParametrosVideo(datos) {
  const { codecVideo, bitrateVideo, resolucion, fps } = datos;

  // Sin codec elegido -> copiamos el video tal cual llega (más eficiente)
  if (!codecVideo || codecVideo === "copy") {
    return ["-c:v", "copy"];
  }

  const args = ["-c:v", codecVideo];
  if (bitrateVideo) args.push("-b:v", `${bitrateVideo}k`);
  if (resolucion) args.push("-s", resolucion);
  if (fps) args.push("-r", String(fps));

  return args;
}

/**
 * Arma los parámetros de audio: codec, bitrate, pista seleccionada.
 */
function construirParametrosAudio(datos) {
  const { codecAudio, bitrateAudio, seleccionarAudio } = datos;

  const args = [];

  if (!codecAudio || codecAudio === "copy") {
    args.push("-c:a", "copy");
  } else {
    args.push("-c:a", codecAudio);
    if (bitrateAudio) args.push("-b:a", `${bitrateAudio}k`);
  }

  // Si el usuario eligió una pista de audio específica (ej: "0" para la primera)
  if (seleccionarAudio !== undefined && seleccionarAudio !== "") {
    args.push("-map", "0:v:0", "-map", `0:a:${seleccionarAudio}`);
  }

  return args;
}

/**
 * Arma la salida (-f + destino) según el tipo de salida elegido.
 */
function construirSalida(datos) {
  const { tipoSalida, ipMulticast, puertoSalida, ttlUdp } = datos;

  if (tipoSalida === "SRT") {
    return { formato: "mpegts", destino: `srt://${ipMulticast}:${puertoSalida}?mode=listener` };
  }

  if (tipoSalida === "HLS") {
    // HLS necesita una ruta de archivo .m3u8 como salida, no una IP/puerto directo
    return { formato: "hls", destino: `${ipMulticast}` };
  }

  // UDP / Multicast (el caso más común en la empresa)
  const params = ["pkt_size=1316"];
  if (ttlUdp) params.push(`ttl=${ttlUdp}`);
  return {
    formato: "mpegts",
    destino: `udp://${ipMulticast}:${puertoSalida}?${params.join("&")}`,
  };
}

/**
 * Inicia una transmisión completa armando el comando con TODOS los
 * parámetros configurados por el usuario en el formulario avanzado.
 */
function iniciarStream(datos, onLog, onClose) {
  const { id } = datos;

  if (procesosActivos[id]) {
    throw new Error("Ya existe una transmisión activa con este id");
  }

  const entrada = construirEntrada(datos);
  const paramsVideo = construirParametrosVideo(datos);
  const paramsAudio = construirParametrosAudio(datos);
  const { formato, destino } = construirSalida(datos);

  const args = [
    "-i", entrada,
    ...paramsVideo,
    ...paramsAudio,
    "-f", formato,
    destino,
  ];

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

module.exports = {
  iniciarStream,
  detenerStream,
  listarStreamsActivos,
};