export default function StatusStream({ transmitiendo }) {
  return (
    <div className="estado-stream">
      <span className={`punto ${transmitiendo ? "verde" : "gris"}`}></span>
      <span>{transmitiendo ? "Transmitiendo" : "Detenido"}</span>
    </div>
  );
}