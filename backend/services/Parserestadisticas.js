function parsearLineaProgreso(linea) {
  const frameMatch = linea.match(/frame=\s*(\d+)/);
  const fpsMatch = linea.match(/fps=\s*([\d.]+)/);
  const sizeMatch = linea.match(/size=\s*(\d+)(\w+)/);
  const timeMatch = linea.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d+)/);
  const bitrateMatch = linea.match(/bitrate=\s*([\d.]+)(\w+\/s)/);
  const speedMatch = linea.match(/speed=\s*([\d.]+)x/);

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