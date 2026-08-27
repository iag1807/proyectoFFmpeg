/**
 * components/FormMpts.jsx
 * -------------------------
 * Formulario para crear un grupo MPTS: se eligen canales YA
 * GUARDADOS (checkboxes) y se define la IP/puerto de salida
 * combinada. Al guardar, el backend arma un solo comando de
 * FFmpeg que empaqueta todos los canales elegidos.
 */

import { useEffect, useState } from "react";

const BACKEND_URL = "http://localhost:4000";

export default function FormMpts({ onCreado, onCancelar }) {
  const [canalesDisponibles, setCanalesDisponibles] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [nombreGrupo, setNombreGrupo] = useState("");
  const [canalesSeleccionados, setCanalesSeleccionados] = useState([]);
  const [ipSalida, setIpSalida] = useState("");
  const [puertoSalida, setPuertoSalida] = useState("");

  useEffect(() => {
    async function cargar() {
      const respuesta = await fetch(`${BACKEND_URL}/api/canales`);
      const datos = await respuesta.json();
      setCanalesDisponibles(datos);
      setCargando(false);
    }
    cargar();
  }, []);

  function alternarCanal(id) {
    setCanalesSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function manejarGuardar(e) {
    e.preventDefault();

    if (canalesSeleccionados.length === 0) {
      alert("Selecciona al menos un canal para el grupo MPTS.");
      return;
    }

    await fetch(`${BACKEND_URL}/api/mpts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombreGrupo,
        ipSalida,
        puertoSalida,
        canalesIds: canalesSeleccionados,
      }),
    });

    onCreado?.();
  }

  return (
    <form onSubmit={manejarGuardar} className="formulario-stream">
      <h3 className="titulo-seccion" style={{ marginTop: 0 }}>Nuevo grupo MPTS</h3>

      <label>
        Nombre del grupo
        <input
          type="text"
          placeholder="Portadora 1-6"
          value={nombreGrupo}
          onChange={(e) => setNombreGrupo(e.target.value)}
          required
        />
      </label>

      <p className="mpts-subtitulo">Seleccionar canales a incluir</p>

      {cargando && <p className="lista-canales-vacio">Cargando canales...</p>}

      {!cargando && canalesDisponibles.length === 0 && (
        <p className="lista-canales-vacio">
          No hay canales guardados todavía. Ve a "Canales guardados" y crea al menos dos antes de armar un grupo MPTS.
        </p>
      )}

      <div className="mpts-lista-checks">
        {canalesDisponibles.map((canal) => (
          <label key={canal.id} className="mpts-check-item">
            <input
              type="checkbox"
              checked={canalesSeleccionados.includes(canal.id)}
              onChange={() => alternarCanal(canal.id)}
            />
            {canal.nombre_canal}
            <span className="mpts-check-detalle">{canal.protocolo} · {canal.url_entrada}</span>
          </label>
        ))}
      </div>

      <div className="fila-doble">
        <label>
          IP de salida MPTS
          <input
            type="text"
            placeholder="227.1.1.6"
            value={ipSalida}
            onChange={(e) => setIpSalida(e.target.value)}
            required
          />
        </label>

        <label>
          Puerto
          <input
            type="text"
            placeholder="5006"
            value={puertoSalida}
            onChange={(e) => setPuertoSalida(e.target.value)}
            required
          />
        </label>
      </div>

      <div className="botones">
        <button type="submit">💾 Guardar grupo</button>
        <button type="button" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}