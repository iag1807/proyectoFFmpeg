const { spawn } = require("child_process");

const procesosActivos = {};

function construirEntrada(datos) {
  const { protocolo, urlEntrada, modoSrt, latencia, ttlUdp, encriptacion, tipoAes, fraseSecreta } = datos;

  const protocolosValidos = ["UDP", "SRT", "FILE", "RTMP", "RTSP", "HTTP"];
  if (!protocolosValidos.includes(protocolo)) {
    throw new Error("Protocolo no soportado: " + protocolo);
  }

  if (protocolo === "FILE" || protocolo === "HTTP" || protocolo === "RTMP" || protocolo === "RTSP") {
    return urlEntrada;
  }

  if (protocolo === "SRT") {
    const params = [];
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

  if (protocolo === "UDP") {
    const params = [];
    if (ttlUdp) params.push(`ttl=${ttlUdp}`);
    const queryString = params.length ? "?" + params.join("&") : "";
    return `${urlEntrada}${queryString}`;
  }

  return urlEntrada;
}

function construirParametrosVideo(datos) {
  const { codecVideo, bitrateVideo, resolucion, fps } = datos;

  if (!codecVideo || codecVideo === "copy") {
    return ["-c:v", "copy"];
  }

  const args = ["-c:v", codecVideo];
  if (bitrateVideo) args.push("-b:v", `${bitrateVideo}k`);
  if (resolucion) args.push("-s", resolucion);
  if (fps) args.push("-r", String(fps));

  return args;
}

function construirParametrosAudio(datos) {
  const { codecAudio, bitrateAudio, seleccionarAudio } = datos;

  const args = [];

  if (!codecAudio || codecAudio === "copy") {
    args.push("-c:a", "copy");
  } else {
    args.push("-c:a", codecAudio);
    if (bitrateAudio) args.push("-b:a", `${bitrateAudio}k`);
  }

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

function construirSalida(datos) {
  const { tipoSalida, ipMulticast, puertoSalida, ttlUdp } = datos;

  if (tipoSalida === "SRT") {
    return { formato: "mpegts", destino: `srt://${ipMulticast}:${puertoSalida}?mode=listener` };
  }

  if (tipoSalida === "HLS") {
    // HLS necesita una ruta de archivo .m3u8 como salida, no una IP/puerto directo
    return { formato: "hls", destino: `${ipMulticast}` };
  }

  const params = ["pkt_size=1316", "buffer_size=655360"];
  if (ttlUdp) params.push(`ttl=${ttlUdp}`);
  return {
    formato: "mpegts",
    destino: `udp://${ipMulticast}:${puertoSalida}?${params.join("&")}`,
  };
}

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

const procesosMptsActivos = {};

function construirEntradaParaMpts(canal) {
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

  
  canales.forEach((canal) => {
    args.push("-i", construirEntradaParaMpts(canal));
  });

  canales.forEach((_, indice) => {
    args.push("-map", `${indice}:v`, "-map", `${indice}:a`);
  });

  args.push("-c", "copy");

  canales.forEach((canal, indice) => {
    const streamVideo = indice * 2;
    const streamAudio = indice * 2 + 1;
    const numeroPrograma = indice + 1;
    const tituloLimpio = (canal.nombre_canal || `Canal ${numeroPrograma}`).replace(/"/g, "");

    args.push(
      "-program",
      `title="${tituloLimpio}":program_num=${numeroPrograma}:st=${streamVideo}:st=${streamAudio}`
    );
  });

  const { formato, destino } = construirSalida({
    tipoSalida: datos.tipoSalida || "UDP",
    ipMulticast: ipSalida,
    puertoSalida,
    ttlUdp: datos.ttlUdp,
  });
  args.push("-f", formato, destino);

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