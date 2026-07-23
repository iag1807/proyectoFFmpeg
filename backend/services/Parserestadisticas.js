/**
 * services/parserEstadisticas.js
 * --------------------------------
 * FFmpeg escribe su progreso en texto plano por stderr. Aquí lo
 * convertimos en un objeto de datos estructurado (números reales)
 * para poder mostrarlo en tarjetas dinámicas en el frontend,
 * en vez de solo texto plano.
 */

/**
 * Ejemplo de línea que FFmpeg imprime muchas veces por segundo:
 * frame=73103 fps=30 q=-1.0 size=1201497KiB time=00:40:40.51 bitrate=4033.0kbits/s speed=1x
 *
 * Esta función usa expresiones regulares para sacar cada valor.
 */
function parsearLineaProgreso(linea) {
  const frameMatch = linea.match(/frame=\s*(\d+)/);
  const fpsMatch = linea.match(/fps=\s*([\d.]+)/);
  const sizeMatch = linea.match(/size=\s*(\d+)(\w+)/);
  const timeMatch = linea.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d+)/);
  const bitrateMatch = linea.match(/bitrate=\s*([\d.]+)(\w+\/s)/);
  const speedMatch = linea.match(/speed=\s*([\d.]+)x/);

  // Si no encontramos "frame=" en la línea, no es una línea de progreso
  // (podría ser un mensaje de conexión, un error, etc.)
  if (!frameMatch) return null;

  const stats = {
    frame: frameMatch ? Number(frameMatch[1]) : null,
    fps: fpsMatch ? Number(fpsMatch[1]) : null,
    size: sizeMatch ? `${sizeMatch[1]}${sizeMatch[2]}` : null,
    bitrate: bitrateMatch ? `${bitrateMatch[1]} ${bitrateMatch[2]}` : null,
    speed: speedMatch ? Number(speedMatch[1]) : null,
  };

  if (timeMatch) {
    const [, horas, minutos, segundos] = timeMatch;
    stats.tiempoTranscurrido = `${horas}:${minutos}:${segundos}`;
    stats.segundosTotales = Number(horas) * 3600 + Number(minutos) * 60 + Number(segundos);
  }

  return stats;
}

/**
 * FFmpeg también imprime, justo al conectar, información sobre el
 * stream detectado, por ejemplo:
 *   Stream #0:0: Video: h264 (High), yuv420p, 1920x1080, 30 fps
 *   Stream #0:1: Audio: aac, 48000 Hz, stereo
 *
 * Esta función detecta esas líneas para mostrar info del canal.
 */
function parsearInfoStream(linea) {
  const videoMatch = linea.match(/Video:\s*([\w\d]+).*?(\d{2,5}x\d{2,5})/);
  if (videoMatch) {
    return {
      tipo: "video",
      codec: videoMatch[1],
      resolucion: videoMatch[2],
    };
  }

  const audioMatch = linea.match(/Audio:\s*([\w\d]+),\s*(\d+)\s*Hz,\s*(\w+)/);
  if (audioMatch) {
    return {
      tipo: "audio",
      codec: audioMatch[1],
      frecuencia: `${audioMatch[2]} Hz`,
      canales: audioMatch[3],
    };
  }

  return null;
}

/**
 * FFmpeg reporta ciertos problemas reales de la señal como líneas de
 * advertencia en su salida. No da un "contador de perdidos" como VLC,
 * pero SÍ podemos detectar estas frases, que indican problemas reales:
 *
 *   "Non-monotonic DTS"    -> paquetes llegando fuera de orden/perdidos
 *   "corrupt"              -> datos corruptos en el paquete
 *   "missing picture"      -> un fotograma completo se perdió
 *   "Packet corrupt"       -> paquete dañado descartado
 *   "discontinuity"        -> hueco detectado en la señal (paquetes faltantes)
 *
 * Cada vez que aparece una de estas frases, la contamos como un
 * "evento de pérdida" real confirmado por FFmpeg.
 */
const PATRONES_PERDIDA = [
  { patron: /non-monotonic dts/i, tipo: "Orden de paquetes (DTS)" },
  { patron: /corrupt/i, tipo: "Datos corruptos" },
  { patron: /missing picture/i, tipo: "Fotograma perdido" },
  { patron: /discontinuity/i, tipo: "Discontinuidad en la señal" },
  { patron: /packet too large/i, tipo: "Paquete descartado" },
];

function detectarEventoPerdida(linea) {
  for (const { patron, tipo } of PATRONES_PERDIDA) {
    if (patron.test(linea)) {
      return { tipo, mensaje: linea.trim() };
    }
  }
  return null;
}

module.exports = { parsearLineaProgreso, parsearInfoStream, detectarEventoPerdida };