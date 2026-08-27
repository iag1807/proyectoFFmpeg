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

  // Si el usuario eligió una pista de audio específica (ej: "0" para la primera).
  // Nos protegemos de valores vacíos, undefined, null o el texto "null"
  // (esto último puede pasar si el dato viene de la base de datos con un campo vacío).
  const audioValido =
    seleccionarAudio !== undefined &&
    seleccionarAudio !== null &&
    seleccionarAudio !== "" &&
    seleccionarAudio !== "null" &&
    !Number.isNaN(Number(seleccionarAudio));

  if (audioValido) {
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

/**
 * ------------------------------------------------------------------
 * MPTS — Multiple Program Transport Stream
 * ------------------------------------------------------------------
 * A diferencia de un SPTS (un canal = un flujo), aquí tomamos VARIOS
 * canales guardados y los combinamos en un solo comando de FFmpeg,
 * con una entrada (-i) por cada canal y un "-map" que le dice a
 * FFmpeg "agrega este video/audio como un programa más" dentro del
 * mismo flujo de salida.
 *
 * Ejemplo con 3 canales, el comando final se parece a esto:
 *
 *   ffmpeg -i srt://canal1 -i udp://canal2 -i rtmp://canal3
 *          -map 0:v -map 0:a
 *          -map 1:v -map 1:a
 *          -map 2:v -map 2:a
 *          -c copy -f mpegts udp://227.1.1.6:5006
 */

const procesosMptsActivos = {};

/**
 * Arma el bloque de entrada (-i ...) para UN canal dentro del MPTS,
 * reutilizando la misma lógica de construirEntrada() que ya usamos
 * para SPTS individuales (así los canales SRT dentro del MPTS
 * también respetan latencia, modo caller/listener, encriptación, etc.)
 */
function construirEntradaParaMpts(canal) {
  // Reutilizamos construirEntrada() adaptando los nombres de campo,
  // porque los canales guardados en la base de datos usan snake_case
  // (protocolo, url_entrada, modo_srt...) en vez de camelCase.
  return construirEntrada({
    protocolo: canal.protocolo,
    urlEntrada: canal.url_entrada,
    modoSrt: canal.modo_srt,
    latencia: canal.latencia,
    ttlUdp: canal.ttl_udp,
    encriptacion: canal.encriptacion,
    tipoAes: canal.tipo_aes,
    fraseSecreta: canal.frase_secreta,
  });
}

/**
 * Inicia un grupo MPTS: recibe la lista de canales guardados (ya
 * consultados desde la base de datos) y la IP/puerto de salida
 * combinada, arma un solo comando de ffmpeg con multiples -i y -map.
 *
 * @param {object} datos - { grupoId, canales: [canal1, canal2, ...], ipSalida, puertoSalida }
 */
function iniciarMpts(datos, onLog, onClose) {
  const { grupoId, canales, ipSalida, puertoSalida } = datos;

  if (procesosMptsActivos[grupoId]) {
    throw new Error("Ya existe un MPTS activo con este id de grupo");
  }

  if (!canales || canales.length === 0) {
    throw new Error("El grupo MPTS necesita al menos un canal");
  }

  const args = [];

  // Un -i por cada canal del grupo
  canales.forEach((canal) => {
    args.push("-i", construirEntradaParaMpts(canal));
  });

  // Un -map por cada canal, indicando "toma el video y audio
  // de la entrada N y agregalo como un programa mas"
  canales.forEach((_, indice) => {
    args.push("-map", `${indice}:v`, "-map", `${indice}:a`);
  });

  // Copiamos todo tal cual llega (sin recodificar), igual que en SPTS
  // por defecto -- es lo mas liviano para el servidor.
  args.push("-c", "copy");

  // Salida combinada: un solo flujo mpegts con todos los programas adentro
  const params = ["pkt_size=1316", "buffer_size=655360"];
  const destino = `udp://${ipSalida}:${puertoSalida}?${params.join("&")}`;
  args.push("-f", "mpegts", destino);

  onLog(`Comando MPTS ejecutado: ffmpeg ${args.join(" ")}`);

  const proceso = spawn("ffmpeg", args);
  procesosMptsActivos[grupoId] = proceso;

  proceso.stderr.on("data", (chunk) => {
    onLog(chunk.toString());
  });

  proceso.on("close", (code) => {
    delete procesosMptsActivos[grupoId];
    onClose(code);
  });

  proceso.on("error", (err) => {
    onLog(`Error al ejecutar FFmpeg (MPTS): ${err.message}`);
  });

  return proceso;
}

function detenerMpts(grupoId) {
  const proceso = procesosMptsActivos[grupoId];
  if (!proceso) return false;
  proceso.kill("SIGINT");
  delete procesosMptsActivos[grupoId];
  return true;
}

function listarMptsActivos() {
  return Object.keys(procesosMptsActivos);
}

module.exports = {
  iniciarStream,
  detenerStream,
  listarStreamsActivos,
  iniciarMpts,
  detenerMpts,
  listarMptsActivos,
};