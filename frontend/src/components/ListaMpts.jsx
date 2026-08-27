/**
 * components/ListaMpts.jsx
 * --------------------------
 * Muestra los grupos MPTS guardados, cada uno con la lista de
 * canales que contiene, y botones para iniciar/detener/eliminar.
 * Igual que ListaCanales, sin logs en tiempo real -- solo gestión.
 */

import { useEffect, useState } from "react";

const BACKEND_URL = "http://localhost:4000";

export default function ListaMpts({ onNuevoGrupo, refrescarSenal }) {
  const [grupos, setGrupos] = useState([]);
  const [activos, setActivos] = useState([]);
  const [cargando, setCargando] = useState(true);

  async function cargarGrupos() {
    setCargando(true);
    const [respGrupos, respActivos] = await Promise.all([
      fetch(`${BACKEND_URL}/api/mpts`),
      fetch(`${BACKEND_URL}/api/mpts/activos/lista`),
    ]);
    setGrupos(await respGrupos.json());
    const { activos: listaActivos } = await respActivos.json();
    setActivos(listaActivos);
    setCargando(false);
  }

  useEffect(() => {
    cargarGrupos();
  }, [refrescarSenal]);

  async function manejarIniciar(id) {
    await fetch(`${BACKEND_URL}/api/mpts/${id}/iniciar`, { method: "POST" });
    cargarGrupos();
  }

  async function manejarDetener(id) {
    await fetch(`${BACKEND_URL}/api/mpts/${id}/detener`, { method: "POST" });
    cargarGrupos();
  }

  async function manejarEliminar(id, nombre) {
    const confirmar = window.confirm(`¿Eliminar el grupo MPTS "${nombre}"?`);
    if (!confirmar) return;
    await fetch(`${BACKEND_URL}/api/mpts/${id}`, { method: "DELETE" });
    cargarGrupos();
  }

  if (cargando) {
    return <p className="lista-canales-vacio">Cargando grupos MPTS...</p>;
  }

  return (
    <div className="lista-canales">
      <div className="lista-canales-header">
        <h3 className="titulo-seccion" style={{ margin: 0, border: "none" }}>Grupos MPTS</h3>
        <button type="button" onClick={onNuevoGrupo} className="boton-nuevo-canal">
          + Nuevo grupo MPTS
        </button>
      </div>

      {grupos.length === 0 && (
        <p className="lista-canales-vacio">Aún no hay grupos MPTS creados.</p>
      )}

      <div className="lista-canales-items">
        {grupos.map((grupo) => {
          const estaActivo = activos.includes(String(grupo.id));

          return (
            <div key={grupo.id} className="canal-item mpts-item">
              <div className="canal-item-info">
                <span className={`punto ${estaActivo ? "verde" : "gris"}`}></span>
                <div>
                  <p className="canal-item-nombre">{grupo.nombre_grupo}</p>
                  <p className="canal-item-detalle">
                    Salida: udp://{grupo.ip_salida_mpts}:{grupo.puerto_salida_mpts}
                  </p>
                  <p className="mpts-canales-incluidos">
                    {grupo.canales.map((c) => c.nombre_canal).join(" · ")}
                  </p>
                </div>
              </div>

              <div className="canal-item-botones">
                {estaActivo ? (
                  <button type="button" onClick={() => manejarDetener(grupo.id)} title="Detener">⏹</button>
                ) : (
                  <button type="button" onClick={() => manejarIniciar(grupo.id)} title="Iniciar">▶</button>
                )}
                <button type="button" onClick={() => manejarEliminar(grupo.id, grupo.nombre_grupo)} title="Eliminar">🗑</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}