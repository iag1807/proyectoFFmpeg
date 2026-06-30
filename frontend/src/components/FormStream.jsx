import { useState } from "react";

const PROTOCOLOS = ["UDP", "SRT", "FILE", "RTMP", "RTSP", "HTTP"];

const PLACEHOLDERS = {
    UDP: "udp://127.0.0.1:5000",
    SRT: "srt://servidor:puerto",
    FILE: "C:\\ruta\\al\\video.mp4",
    RTMP: "rtmp://servidor/live/stream",
    RTSP: "rtsp://servidor/stream",
    HTTP: "http://servidor/stream.m3u8",
};

export default function FormStream({ onIniciar, onDetener, transmitiendo }) {
    const [protocolo, setProtocolo] = useState("SRT");
    const [urlEntrada, setUrlEntrada] = useState("");
    const [ipMulticast, setIpMulticast] = useState("");
    const [puerto, setPuerto] = useState("");

    function manejarEnvio(e) {
        e.preventDefault();
        const id = `canal-${Date.now()}`;
        onIniciar({ id, protocolo, urlEntrada, ipMulticast, puerto });
    }

    return (
        <form onSubmit={manejarEnvio} className="formulario-stream">
            <label>
                Protocolo de entrada
                <select value={protocolo} onChange={(e) => setProtocolo(e.target.value)}>
                    {PROTOCOLOS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                    ))}
                </select>
            </label>

            <label>
                URL de entrada
                <input
                    type="text"
                    placeholder={PLACEHOLDERS[protocolo]}
                    value={urlEntrada}
                    onChange={(e) => setUrlEntrada(e.target.value)}
                    required
                />
            </label>

            <div className="fila-doble">
                <label>
                    IP Multicast de salida
                    <input
                        type="text"
                        placeholder="239.0.0.1"
                        value={ipMulticast}
                        onChange={(e) => setIpMulticast(e.target.value)}
                        required
                    />
                </label>

                <label>
                    Puerto
                    <input
                        type="text"
                        placeholder="1234"
                        value={puerto}
                        onChange={(e) => setPuerto(e.target.value)}
                        required
                    />
                </label>
            </div>

            <div className="botones">
                <button type="submit" disabled={transmitiendo}>▶ Iniciar</button>
                <button type="button" onClick={onDetener} disabled={!transmitiendo}>⏹ Detener</button>
            </div>
        </form>
    );
}