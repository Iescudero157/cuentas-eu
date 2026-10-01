"use client";

// V11 · Tarjeta de Ajustes: certificado digital para VERI*FACTU.
// Sube el .p12/.pfx del emisor (se envía UNA vez por HTTPS a la API, que lo
// valida y lo custodia cifrado). Aquí solo se muestran METADATOS; el material
// y la contraseña no se guardan en el navegador ni en localStorage.

import { useCallback, useEffect, useRef, useState } from "react";
import { FileKey2, Loader2, ShieldCheck, ShieldAlert, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";

interface CertificadoResumen {
  id: string;
  tipo: "obligado" | "representante" | "sello";
  subjectCn: string;
  nifCertificado: string | null;
  nifRepresentado: string | null;
  emisorCn: string | null;
  validoHasta: string;
  caducidad: { estado: "valido" | "caduca_pronto" | "caducado"; diasRestantes: number };
}

const TIPO_LABEL: Record<CertificadoResumen["tipo"], string> = {
  obligado: "Certificado del emisor",
  representante: "Certificado de representante",
  sello: "Sello de entidad",
};

function CaducidadBadge({ caducidad }: { caducidad: CertificadoResumen["caducidad"] }) {
  if (caducidad.estado === "caducado") {
    return (
      <span className="text-xs bg-red-50 text-red-600 px-3 py-1 rounded-full font-medium">
        Caducado
      </span>
    );
  }
  if (caducidad.estado === "caduca_pronto") {
    return (
      <span className="text-xs bg-amber-50 text-amber-600 px-3 py-1 rounded-full font-medium">
        Caduca en {caducidad.diasRestantes} días
      </span>
    );
  }
  return (
    <span className="text-xs bg-brand-success/10 text-brand-success px-3 py-1 rounded-full font-medium">
      Válido
    </span>
  );
}

export default function CertificadoCard() {
  const { user, isDemo } = useAuth();
  const [cargando, setCargando] = useState(true);
  const [certificado, setCertificado] = useState<CertificadoResumen | null>(null);
  const [custodiaConfigurada, setCustodiaConfigurada] = useState(true);
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/verifactu/certificado");
      if (res.ok) {
        const data = await res.json();
        setCertificado(data.certificado ?? null);
        setCustodiaConfigurada(Boolean(data.custodiaConfigurada));
      }
    } catch {
      // sin red: la tarjeta queda en estado vacío
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!user || isDemo) {
      setCargando(false);
      return;
    }
    void cargar();
  }, [user, isDemo, cargar]);

  async function handleSubir() {
    const fichero = fileRef.current?.files?.[0];
    setMensaje(null);
    if (!fichero) {
      setMensaje({ tipo: "error", texto: "Selecciona el fichero .p12 o .pfx de tu certificado" });
      return;
    }
    setEnviando(true);
    try {
      const buf = await fichero.arrayBuffer();
      let bin = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      const res = await fetch("/api/verifactu/certificado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pfx_base64: btoa(bin), passphrase: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMensaje({ tipo: "error", texto: data.error ?? "No se pudo guardar el certificado" });
      } else {
        setCertificado(data.certificado);
        setMensaje({ tipo: "ok", texto: "Certificado guardado y custodiado cifrado" });
        setPassword("");
        if (fileRef.current) fileRef.current.value = "";
      }
    } catch {
      setMensaje({ tipo: "error", texto: "Error de conexión subiendo el certificado" });
    } finally {
      setEnviando(false);
    }
  }

  async function handleRetirar() {
    if (!confirm("¿Retirar el certificado? Las facturas seguirán emitiéndose, pero no se remitirán a la AEAT hasta subir otro.")) {
      return;
    }
    setEnviando(true);
    setMensaje(null);
    try {
      const res = await fetch("/api/verifactu/certificado", { method: "DELETE" });
      if (res.ok) {
        setCertificado(null);
        setMensaje({ tipo: "ok", texto: "Certificado retirado (material purgado)" });
      } else {
        const data = await res.json();
        setMensaje({ tipo: "error", texto: data.error ?? "No se pudo retirar el certificado" });
      }
    } catch {
      setMensaje({ tipo: "error", texto: "Error de conexión" });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="bg-white rounded-xl p-6 border border-brand-border/50 shadow-sm space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FileKey2 className="w-5 h-5 text-brand-blue" />
        <h3 className="font-semibold text-brand-text">Certificado digital (VERI*FACTU)</h3>
      </div>

      {isDemo || !user ? (
        <p className="text-sm text-brand-muted">
          Disponible con una cuenta real: el certificado se usa para remitir tus facturas a la AEAT.
        </p>
      ) : cargando ? (
        <div className="flex items-center gap-2 text-sm text-brand-muted">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : (
        <>
          {!custodiaConfigurada && (
            <p className="text-xs bg-amber-50 text-amber-700 rounded-lg p-3">
              La custodia de certificados aún no está configurada en el servidor: la subida no
              funcionará hasta que se active.
            </p>
          )}

          {certificado ? (
            <div className="bg-brand-blue/5 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {certificado.caducidad.estado === "valido" ? (
                    <ShieldCheck className="w-4 h-4 text-brand-success shrink-0" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                  <p className="text-sm font-medium text-brand-text truncate">{certificado.subjectCn}</p>
                </div>
                <CaducidadBadge caducidad={certificado.caducidad} />
              </div>
              <p className="text-xs text-brand-muted">
                {TIPO_LABEL[certificado.tipo]}
                {certificado.nifCertificado ? ` · NIF ${certificado.nifCertificado}` : ""}
                {certificado.nifRepresentado ? ` · Representa a ${certificado.nifRepresentado}` : ""}
              </p>
              <p className="text-xs text-brand-muted">
                {certificado.emisorCn ? `Emitido por ${certificado.emisorCn} · ` : ""}
                Válido hasta {new Date(certificado.validoHasta).toLocaleDateString("es-ES")}
              </p>
              <button
                type="button"
                onClick={handleRetirar}
                disabled={enviando}
                className="flex items-center gap-1.5 text-xs text-red-600 font-medium hover:underline disabled:opacity-60 pt-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Retirar certificado
              </button>
            </div>
          ) : (
            <p className="text-sm text-brand-muted">
              Sube tu certificado digital (fichero .p12/.pfx, p. ej. el de la FNMT) para que tus
              facturas se remitan automáticamente a la AEAT. Se guarda cifrado y solo se usa para
              la conexión segura con Hacienda.
            </p>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">
                {certificado ? "Sustituir por otro certificado" : "Fichero del certificado"}
              </label>
              <input
                ref={fileRef}
                type="file"
                accept=".p12,.pfx,application/x-pkcs12"
                className="w-full text-sm text-brand-muted file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-brand-blue/10 file:text-brand-blue file:text-sm file:font-medium hover:file:bg-brand-blue/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1">Contraseña del certificado</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
                className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
              />
              <p className="text-xs text-brand-muted mt-1">
                Se usa una sola vez para validar el fichero; no se muestra ni se registra.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSubir}
              disabled={enviando || !custodiaConfigurada}
              className="flex items-center justify-center gap-2 bg-brand-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-60"
            >
              {enviando ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Procesando…</>
              ) : (
                <><Upload className="w-4 h-4" /> {certificado ? "Sustituir certificado" : "Subir certificado"}</>
              )}
            </button>
          </div>

          {mensaje && (
            <p
              className={`text-xs rounded-lg p-3 ${
                mensaje.tipo === "ok" ? "bg-brand-success/10 text-brand-success" : "bg-red-50 text-red-600"
              }`}
            >
              {mensaje.texto}
            </p>
          )}
        </>
      )}
    </div>
  );
}
