import { useEffect, useRef } from "react";

export default function LogsStream({ logs }) {
  const finRef = useRef(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="caja-logs">
      <h3>Logs en tiempo real</h3>
      <div className="contenido-logs">
        {logs.length === 0 && <p className="vacio">Aún no hay actividad...</p>}
        {logs.map((linea, i) => (
          <div key={i} className="linea-log">{linea}</div>
        ))}
        <div ref={finRef} />
      </div>
    </div>
  );
}