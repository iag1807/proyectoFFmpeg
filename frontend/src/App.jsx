import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import FormStream from "./components/FormStream";
import StatusStream from "./components/StatusStream";
import LogsStream from "./components/LogsStream";
import "./styles/main.css";

const BACKEND_URL = "http://localhost:4000";

export default function App() {
  const [logs, setLogs] = useState([]);
  const [transmitiendo, setTransmitiendo] = useState(false);
  const idActualRef = useRef(null);

  useEffect(() => {
    const socket = io(BACKEND_URL);

    socket.on("log", (data) => {
      if (data.id === idActualRef.current) {
        setLogs((prev) => [...prev, data.mensaje]);
      }
    });

    socket.on("estado", (data) => {
      if (data.id === idActualRef.current) {
        setTransmitiendo(data.estado === "transmitiendo");
      }
    });

    return () => socket.disconnect();
  }, []);

  async function manejarIniciar(datos) {
    idActualRef.current = datos.id;
    setLogs([]);

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
  }

  return (
  <div className="app-container">
    
    <p className="subtitulo">Convierte cualquier protocolo de streaming a UDP Multicast</p>

    <div className="layout-dos-columnas">
      <div className="columna-formulario">
        <FormStream
          onIniciar={manejarIniciar}
          onDetener={manejarDetener}
          transmitiendo={transmitiendo}
        />
        <StatusStream transmitiendo={transmitiendo} />
      </div>

      <div className="columna-logs">
        <LogsStream logs={logs} />
      </div>
    </div>
  </div>
);
}