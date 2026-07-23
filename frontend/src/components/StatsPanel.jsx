/**
 * components/StatsPanel.jsx
 * --------------------------
 * Muestra tarjetas con las estadísticas en vivo de la transmisión:
 * bitrate, fps, velocidad, tiempo transcurrido, tamaño, y la info
 * de video/audio detectada (codec, resolución, canales de audio).
 */

export default function StatsPanel({ stats, infoVideo, infoAudio, eventosPerdida }) {
  if (!stats) {
    return (
      <div className="stats-panel-vacio">
        <p>Las estadísticas aparecerán aquí cuando inicies una transmisión.</p>
      </div>
    );
  }

  // El "speed" nos dice si la transmisión va al ritmo del tiempo real.
  // Por debajo de 0.95x lo marcamos en alerta (riesgo de acumular retraso).
  const speedEnRiesgo = stats.speed !== null && stats.speed < 0.95;
  const totalPerdidas = eventosPerdida?.total ?? 0;
  const hayPerdidas = totalPerdidas > 0;

  return (
    <div className="stats-panel">
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Bitrate</span>
          <span className="stat-valor">{stats.bitrate ?? "--"}</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">FPS</span>
          <span className="stat-valor">{stats.fps ?? "--"}</span>
        </div>

        <div className={`stat-card ${speedEnRiesgo ? "stat-alerta" : ""}`}>
          <span className="stat-label">Velocidad</span>
          <span className="stat-valor">{stats.speed !== null ? `${stats.speed}x` : "--"}</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Tiempo transmitido</span>
          <span className="stat-valor">{stats.tiempoTranscurrido ?? "--"}</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Tamaño acumulado</span>
          <span className="stat-valor">{stats.size ?? "--"}</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Fotogramas</span>
          <span className="stat-valor">{stats.frame ?? "--"}</span>
        </div>

        <div className={`stat-card ${hayPerdidas ? "stat-alerta" : ""}`}>
          <span className="stat-label">Alerta de pérdida</span>
          <span className="stat-valor">{totalPerdidas}</span>
        </div>
      </div>

      {(infoVideo || infoAudio) && (
        <div className="stats-info-canal">
          {infoVideo && (
            <div className="info-canal-item">
              <span>Codec: {infoVideo.codec}</span>
              <span>Resolución: {infoVideo.resolucion}</span>
            </div>
          )}
          {infoAudio && (
            <div className="info-canal-item">
              <span className="info-canal-titulo">🔊 Audio</span>
              <span>Codec: {infoAudio.codec}</span>
              <span>{infoAudio.frecuencia} · {infoAudio.canales}</span>
            </div>
          )}
        </div>
      )}

      {speedEnRiesgo && (
        <p className="stats-alerta-texto">
          ⚠ La velocidad de procesamiento está por debajo del tiempo real — riesgo de acumular retraso.
        </p>
      )}

      {hayPerdidas && (
        <p className="stats-alerta-texto">
          ⚠ Último evento: {eventosPerdida.ultimoEvento?.tipo}
        </p>
      )}
    </div>
  );
}