/**
 * services/ffmpeg.js
 * -------------------
 * Arma y ejecuta los comandos FFmpeg según TODOS los parámetros
 * que el usuario configura en el formulario: entrada, salida,
 * codecs, resolución, audio, encriptación SRT, etc.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const procesosActivos = {};

// Carpeta donde se guardan los segmentos HLS de cada canal,
// para que el navegador pueda pedirlos como archivos normales.
const CARPETA_STREAMS = path.join(__dirname, "..", "streams");

function asegurarCarpetaCanal(id) {
  const carpeta = path.join(CARPETA_STREAMS, id);
  if (!fs.existsSync(carpeta)) {
    fs.mkdirSync(carpeta, { recursive: true });
  }
  return carpeta;
}

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
    // Si no se especifico latencia, o es muy baja, usamos un minimo seguro
    // de 2000ms para darle a SRT margen suficiente para recuperar paquetes
    // perdidos antes de descartarlos (reduce las perdidas reportadas por VLC).
    const latenciaSegura = latencia && Number(latencia) >= 2000 ? latencia : 2000;
    if (modoSrt) params.push(`mode=${modoSrt}`);
    params.push(`latency=${latenciaSegura}`);
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
  // buffer_size más grande = menos probabilidad de perder paquetes
  // cuando el sistema esta bajo carga (varios procesos corriendo a la vez)
  const params = ["pkt_size=1316", "buffer_size=655360"];
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
  const { id, generarVistaPrevia } = datos;

  if (procesosActivos[id]) {
    throw new Error("Ya existe una transmisión activa con este id");
  }

  const entrada = construirEntrada(datos);
  const paramsVideo = construirParametrosVideo(datos);
  const paramsAudio = construirParametrosAudio(datos);
  const { formato, destino } = construirSalida(datos);

  // Salida principal (la que ya teniamos: Multicast, SRT o HLS "real")
  const args = [
    "-i", entrada,
    ...paramsVideo,
    ...paramsAudio,
    "-f", formato,
    destino,
  ];

  // Si el usuario activo la vista previa web, agregamos UNA SEGUNDA salida
  // en el MISMO comando de ffmpeg: un HLS liviano guardado en disco,
  // que el navegador podra reproducir con hls.js
  if (generarVistaPrevia) {
    const carpetaCanal = asegurarCarpetaCanal(id);
    const rutaM3u8 = path.join(carpetaCanal, "index.m3u8");

    args.push(
      "-c:v", "libx264",
      "-c:a", "aac",
      "-f", "hls",
      "-hls_time", "4",
      "-hls_list_size", "5",
      "-hls_flags", "delete_segments",
      rutaM3u8
    );

    onLog(`Vista previa HLS habilitada en: /streams/${id}/index.m3u8`);
  }

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

  // Limpiamos los archivos .ts y .m3u8 del canal, ya no se necesitan
  const carpetaCanal = path.join(CARPETA_STREAMS, id);
  if (fs.existsSync(carpetaCanal)) {
    fs.rmSync(carpetaCanal, { recursive: true, force: true });
  }

  return true;
}

function listarStreamsActivos() {
  return Object.keys(procesosActivos);
}

module.exports = {
  iniciarStream,
  detenerStream,
  listarStreamsActivos,
  CARPETA_STREAMS,
};