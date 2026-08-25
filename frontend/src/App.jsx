/**
 * App.jsx
 * -------
 * Componente principal. Aquí se conecta con el backend
 * (vía fetch para las acciones y Socket.io para los logs en vivo)
 * y se arman los componentes hijos.
 */

import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import FormStream from "./components/FormStream";
import StatusStream from "./components/StatusStream";
import LogsStream from "./components/LogsStream";
import StatsPanel from "./components/StatsPanel";
import ListaCanales from "./components/ListaCanales";
import "./styles/main.css";

const BACKEND_URL = "http://localhost:4000";

export default function App() {
  const [vista, setVista] = useState("transmision"); // "transmision" | "canales"
  const [canalEditando, setCanalEditando] = useState(null);
  const [logs, setLogs] = useState([]);
  const [transmitiendo, setTransmitiendo] = useState(false);
  const [stats, setStats] = useState(null);
  const [infoVideo, setInfoVideo] = useState(null);
  const [infoAudio, setInfoAudio] = useState(null);
  const [eventosPerdida, setEventosPerdida] = useState(null);
  const idActualRef = useRef(null); // guarda el id del stream que está corriendo

  // Nos conectamos a Socket.io una sola vez, cuando carga la página
  useEffect(() => {
    const socket = io(BACKEND_URL);

    socket.on("log", (data) => {
      // Solo mostramos logs del stream que nosotros iniciamos
      if (data.id === idActualRef.current) {
        setLogs((prev) => [...prev, data.mensaje]);
      }
    });

    socket.on("estado", (data) => {
      if (data.id === idActualRef.current) {
        setTransmitiendo(data.estado === "transmitiendo");
      }
    });

    // Estadísticas en vivo (frame, fps, bitrate, speed...)
    socket.on("stats", (data) => {
      if (data.id === idActualRef.current) {
        setStats(data.stats);
      }
    });

    // Info detectada del stream (codec y resolución de video, o codec/canales de audio)
    socket.on("infoStream", (data) => {
      if (data.id === idActualRef.current) {
        if (data.infoStream.tipo === "video") setInfoVideo(data.infoStream);
        if (data.infoStream.tipo === "audio") setInfoAudio(data.infoStream);
      }
    });

    // Eventos de pérdida detectados por FFmpeg (contador acumulado)
    socket.on("perdida", (data) => {
      if (data.id === idActualRef.current) {
        setEventosPerdida({ total: data.total, ultimoEvento: data.ultimoEvento });
      }
    });

    return () => socket.disconnect();
  }, []);

  async function manejarIniciar(datos) {
    idActualRef.current = datos.id;
    setLogs([]); // limpiamos logs anteriores
    setStats(null);
    setInfoVideo(null);
    setInfoAudio(null);
    setEventosPerdida(null);

    const respuesta = await fetch(`${BACKEND_URL}/api/stream/iniciar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });

    if (!respuesta.ok) {
      const error = await respuesta.json();
      setLogs((prev) => [...prev, `Error: ${error.error}`]);
      return;
    }

    setTransmitiendo(true);
  }

  async function manejarDetener() {
    if (!idActualRef.current) return;

    await fetch(`${BACKEND_URL}/api/stream/detener`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: idActualRef.current }),
    });

    setTransmitiendo(false);
    setStats(null);
  }

  // Inicia un canal que YA estaba guardado en la base de datos (desde la lista)
  function manejarIniciarGuardado(canal) {
    manejarIniciar({
      id: String(canal.id),
      nombreCanal: canal.nombre_canal,
      protocolo: canal.protocolo,
      urlEntrada: canal.url_entrada,
      modoSrt: canal.modo_srt,
      latencia: canal.latencia,
      ttlUdp: canal.ttl_udp,
      encriptacion: canal.encriptacion,
      tipoAes: canal.tipo_aes,
      fraseSecreta: canal.frase_secreta,
      tipoSalida: canal.tipo_salida,
      ipMulticast: canal.ip_salida,
      puertoSalida: canal.puerto_salida,
      codecVideo: canal.codec_video,
      bitrateVideo: canal.bitrate_video,
      resolucion: canal.resolucion,
      fps: canal.fps,
      codecAudio: canal.codec_audio,
      bitrateAudio: canal.bitrate_audio,
      seleccionarAudio: canal.seleccionar_audio,
    });
  }

  return (
    <div className="app-container">
      <p className="subtitulo">Convierte cualquier protocolo de streaming a UDP Multicast</p>

      <div className="pestañas">
        <button
          type="button"
          className={vista === "transmision" ? "pestaña-activa" : ""}
          onClick={() => setVista("transmision")}
        >
          Transmisión individual
        </button>
        <button
          type="button"
          className={vista === "canales" ? "pestaña-activa" : ""}
          onClick={() => setVista("canales")}
        >
          Canales guardados
        </button>
      </div>

      {vista === "transmision" && (
        <div className="layout-dos-columnas">
          <div className="columna-formulario">
            <FormStream
              onIniciar={manejarIniciar}
              onDetener={manejarDetener}
              transmitiendo={transmitiendo}
              canalEditando={canalEditando}
              onGuardado={() => {
                setCanalEditando(null);
                setVista("canales");
              }}
            />
            <StatusStream transmitiendo={transmitiendo} />
          </div>

          <div className="columna-logs">
            <StatsPanel stats={stats} infoVideo={infoVideo} infoAudio={infoAudio} eventosPerdida={eventosPerdida} />
            <LogsStream logs={logs} />
          </div>
        </div>
      )}

      {vista === "canales" && (
        <ListaCanales
          canalesActivos={transmitiendo ? [idActualRef.current] : []}
          onNuevoCanal={() => {
            setCanalEditando(null);
            setVista("transmision");
          }}
          onEditarCanal={(canal) => {
            setCanalEditando(canal);
            setVista("transmision");
          }}
          onIniciar={manejarIniciarGuardado}
          onDetener={manejarDetener}
        />
      )}
    </div>
  );
}