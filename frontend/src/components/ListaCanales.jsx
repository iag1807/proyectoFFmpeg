/**
 * components/ListaCanales.jsx
 * ------------------------------
 * Muestra todos los canales SPTS guardados en la base de datos.
 * Cada fila tiene botones para Iniciar (usa el motor de ffmpeg que
 * ya existe), Editar (carga sus datos en el formulario) y Eliminar.
 *
 * Esta pantalla NO muestra logs en tiempo real, tal como se pidió --
 * es solo gestión de la configuración guardada.
 */

import { useEffect, useState } from "react";

const BACKEND_URL = "http://localhost:4000";

export default function ListaCanales({ onNuevoCanal, onEditarCanal, canalesActivos, onIniciar, onDetener }) {
  const [canales, setCanales] = useState([]);
  const [cargando, setCargando] = useState(true);

  async function cargarCanales() {
    setCargando(true);
    try {
      const respuesta = await fetch(`${BACKEND_URL}/api/canales`);
      const datos = await respuesta.json();
      setCanales(datos);
    } catch (err) {
      console.error("Error cargando canales:", err);
    }
    setCargando(false);
  }

  useEffect(() => {
    cargarCanales();
  }, []);

  async function manejarEliminar(id, nombre) {
    const confirmar = window.confirm(`¿Eliminar el canal "${nombre}"? Esta acción no se puede deshacer.`);
    if (!confirmar) return;

    await fetch(`${BACKEND_URL}/api/canales/${id}`, { method: "DELETE" });
    cargarCanales();
  }

  if (cargando) {
    return <p className="lista-canales-vacio">Cargando canales...</p>;
  }

  return (
    <div className="lista-canales">
      <div className="lista-canales-header">
        <h3 className="titulo-seccion" style={{ margin: 0, border: "none" }}>Canales guardados</h3>
        <button type="button" onClick={onNuevoCanal} className="boton-nuevo-canal">
          + Nuevo canal
        </button>
      </div>

      {canales.length === 0 && (
        <p className="lista-canales-vacio">Aún no hay canales guardados. Crea el primero.</p>
      )}

      <div className="lista-canales-items">
        {canales.map((canal) => {
          const estaActivo = canalesActivos?.includes(String(canal.id));

          return (
            <div key={canal.id} className="canal-item">
              <div className="canal-item-info">
                <span className={`punto ${estaActivo ? "verde" : "gris"}`}></span>
                <div>
                  <p className="canal-item-nombre">{canal.nombre_canal}</p>
                  <p className="canal-item-detalle">
                    {canal.protocolo} · {canal.url_entrada}
                  </p>
                </div>
              </div>

              <div className="canal-item-botones">
                {estaActivo ? (
                  <button type="button" onClick={() => onDetener(canal.id)} title="Detener">⏹</button>
                ) : (
                  <button type="button" onClick={() => onIniciar(canal)} title="Iniciar">▶</button>
                )}
                <button type="button" onClick={() => onEditarCanal(canal)} title="Editar">✎</button>
                <button type="button" onClick={() => manejarEliminar(canal.id, canal.nombre_canal)} title="Eliminar">🗑</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}