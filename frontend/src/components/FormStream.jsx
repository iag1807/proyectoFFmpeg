/**
 * components/FormStream.jsx
 * --------------------------
 * Formulario completo con Entrada y Salida, similar al software
 * de la empresa: incluye parámetros avanzados de SRT, UDP,
 * video y audio, mostrando solo los campos relevantes según
 * el protocolo elegido.
 */

import { useState } from "react";

const PROTOCOLOS_ENTRADA = ["UDP", "SRT", "FILE", "RTMP", "RTSP", "HTTP"];
const PROTOCOLOS_SALIDA = ["UDP", "SRT", "HLS"];


export default function FormStream({ onIniciar, onDetener, transmitiendo }) {
  // ---- Datos generales ----
  const [nombreCanal, setNombreCanal] = useState("");
  const [protocolo, setProtocolo] = useState("SRT");
  const [urlEntrada, setUrlEntrada] = useState("");

  // ---- Solo para SRT ----
  const [modoSrt, setModoSrt] = useState("caller");
  const [latencia, setLatencia] = useState("1500");
  const [encriptacion, setEncriptacion] = useState(false);
  const [tipoAes, setTipoAes] = useState("32");
  const [fraseSecreta, setFraseSecreta] = useState("");

  // ---- Solo para UDP ----
  const [ttlUdp, setTtlUdp] = useState("16");

  // ---- Salida ----
  const [tipoSalida, setTipoSalida] = useState("UDP");
  const [ipMulticast, setIpMulticast] = useState("");
  const [puertoSalida, setPuertoSalida] = useState("");

  // ---- Salida avanzada (opcional, puede dejarse vacío = copiar tal cual) ----
  const [codecVideo, setCodecVideo] = useState("copy");
  const [bitrateVideo, setBitrateVideo] = useState("");
  const [resolucion, setResolucion] = useState("");
  const [fps, setFps] = useState("");
  const [codecAudio, setCodecAudio] = useState("copy");
  const [bitrateAudio, setBitrateAudio] = useState("");
  const [seleccionarAudio, setSeleccionarAudio] = useState("");

  function manejarEnvio(e) {
    e.preventDefault();
    const id = `canal-${Date.now()}`;
    onIniciar({
      id,
      nombreCanal,
      protocolo,
      urlEntrada,
      modoSrt,
      latencia,
      ttlUdp,
      encriptacion,
      tipoAes,
      fraseSecreta,
      tipoSalida,
      ipMulticast,
      puertoSalida,
      codecVideo,
      bitrateVideo,
      resolucion,
      fps,
      codecAudio,
      bitrateAudio,
      seleccionarAudio,
    });
  }

  return (
    <form onSubmit={manejarEnvio} className="formulario-stream">
      {/* ---------------- ENTRADA ---------------- */}
      <h3 className="titulo-seccion">Entrada</h3>

      <label>
        Nombre del canal
        <input
          type="text"
          value={nombreCanal}
          onChange={(e) => setNombreCanal(e.target.value)}
        />
      </label>

      <label>
        Protocolo de entrada
        <select value={protocolo} onChange={(e) => setProtocolo(e.target.value)}>
          {PROTOCOLOS_ENTRADA.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </label>

      <label>
        URL de entrada
        <input
          type="text"
          value={urlEntrada}
          onChange={(e) => setUrlEntrada(e.target.value)}
          required
        />
      </label>

      {/* Campos que solo aplican para SRT */}
      {protocolo === "SRT" && (
        <div className="grupo-avanzado">
          <div className="fila-doble">
            <label>
              Modo SRT
              <select value={modoSrt} onChange={(e) => setModoSrt(e.target.value)}>
                <option value="caller">Caller</option>
                <option value="listener">Listener</option>
              </select>
            </label>

            <label>
              Latencia (ms)
              <input
                type="number"
                value={latencia}
                onChange={(e) => setLatencia(e.target.value)}
              />
            </label>
          </div>

          <label className="fila-checkbox">
            <input
              type="checkbox"
              checked={encriptacion}
              onChange={(e) => setEncriptacion(e.target.checked)}
            />
            Usar encriptación
          </label>

          {encriptacion && (
            <div className="fila-doble">
              <label>
                Tipo AES
                <select value={tipoAes} onChange={(e) => setTipoAes(e.target.value)}>
                  <option value="16">16 (AES128)</option>
                  <option value="24">24 (AES192)</option>
                  <option value="32">32 (AES256)</option>
                </select>
              </label>

              <label>
                Frase secreta
                <input
                  type="password"
                  value={fraseSecreta}
                  onChange={(e) => setFraseSecreta(e.target.value)}
                />
              </label>
            </div>
          )}
        </div>
      )}

      {/* Campos que solo aplican para UDP */}
      {protocolo === "UDP" && (
        <div className="grupo-avanzado">
          <label>
            TTL UDP
            <input
              type="number"
              value={ttlUdp}
              onChange={(e) => setTtlUdp(e.target.value)}
            />
          </label>
        </div>
      )}

      {/* ---------------- SALIDA ---------------- */}
      <h3 className="titulo-seccion">Salida</h3>

      <label>
        Tipo de salida
        <select value={tipoSalida} onChange={(e) => setTipoSalida(e.target.value)}>
          {PROTOCOLOS_SALIDA.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </label>

      <div className="fila-doble">
        <label>
          {tipoSalida === "HLS" ? "Ruta del archivo .m3u8" : "Dirección de salida"}
          <input
            type="text"
            value={ipMulticast}
            onChange={(e) => setIpMulticast(e.target.value)}
            required
          />
        </label>

        {tipoSalida !== "HLS" && (
          <label>
            Puerto
            <input
              type="text"
              value={puertoSalida}
              onChange={(e) => setPuertoSalida(e.target.value)}
              required
            />
          </label>
        )}
      </div>

      <details className="avanzado-salida">
        <summary>Opciones avanzadas de video y audio (opcional)</summary>

        <div className="fila-doble">
          <label>
            Codec Video
            <select value={codecVideo} onChange={(e) => setCodecVideo(e.target.value)}>
              <option value="copy">Copiar (sin recodificar)</option>
              <option value="libx264">H.264</option>
              <option value="libx265">H.265</option>
            </select>
          </label>

          <label>
            Bitrate Video (kbps)
            <input
              type="number"
              value={bitrateVideo}
              onChange={(e) => setBitrateVideo(e.target.value)}
              disabled={codecVideo === "copy"}
            />
          </label>
        </div>

        <div className="fila-doble">
          <label>
            Resolución
            <input
              type="text"
              value={resolucion}
              onChange={(e) => setResolucion(e.target.value)}
              disabled={codecVideo === "copy"}
            />
          </label>

          <label>
            FPS
            <input
              type="number"
              value={fps}
              onChange={(e) => setFps(e.target.value)}
              disabled={codecVideo === "copy"}
            />
          </label>
        </div>

        <div className="fila-doble">
          <label>
            Codec Audio
            <select value={codecAudio} onChange={(e) => setCodecAudio(e.target.value)}>
              <option value="copy">Copiar (sin recodificar)</option>
              <option value="aac">AAC</option>
              <option value="mp3">MP3</option>
            </select>
          </label>

          <label>
            Bitrate Audio (kbps)
            <input
              type="number"
              value={bitrateAudio}
              onChange={(e) => setBitrateAudio(e.target.value)}
              disabled={codecAudio === "copy"}
            />
          </label>
        </div>

        <label>
          Seleccionar pista de audio (0 = primera, 1 = segunda...)
          <input
            type="number"
            value={seleccionarAudio}
            onChange={(e) => setSeleccionarAudio(e.target.value)}
          />
        </label>
      </details>

      <div className="botones">
        <button type="submit" disabled={transmitiendo}>▶ Iniciar</button>
        <button type="button" onClick={onDetener} disabled={!transmitiendo}>⏹ Detener</button>
      </div>
    </form>
  );
}