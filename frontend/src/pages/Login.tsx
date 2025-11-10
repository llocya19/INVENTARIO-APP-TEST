// src/pages/Login.tsx
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { login } from "../services/authService";

/* =========================
   Tema Hospital – Crema + Blanco + Turquesa
========================= */
const BRAND = "#80F9FA"; // turquesa institucional
const BG_APP = "bg-[#FFFDF8]";
const TEXT = "text-slate-800";
const MUTED = "text-slate-600";
const section = "rounded-3xl border border-slate-200 bg-white shadow-sm";
const card = "rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm";
const baseText = "leading-relaxed tracking-[0.01em]";

// Controles accesibles
const focusRing = `focus:outline-none focus:ring-2 focus:ring-[${BRAND}]/50 focus:border-[${BRAND}]`;

// Campos de texto
const fieldBase =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-base placeholder-slate-400 " +
  TEXT +
  " " +
  focusRing +
  " transition";

// Botón principal
const btnPrimary = `inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-base 
bg-[${BRAND}] text-slate-900 font-medium hover:bg-[#6EEBEB] active:bg-[#4FD4D5] transition 
disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[112px]`;

/* =========================
   Página Login
========================= */
export default function Login() {
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [caps, setCaps] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = username.trim().length >= 3 && password.length >= 4 && !loading;
  const userRef = useRef<HTMLInputElement | null>(null);
  const errRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    userRef.current?.focus();
    const last = localStorage.getItem("last_user");
    if (last) setU(last);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setMsg(null);
    try {
      await login(username.trim(), password);
      if (remember) localStorage.setItem("last_user", username.trim());
      else localStorage.removeItem("last_user");
      location.href = "/";
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "Error de autenticación");
      setTimeout(() => errRef.current?.focus(), 0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`${BG_APP} ${TEXT} min-h-screen flex items-center justify-center p-4`}>
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        {/* Panel ilustrativo */}
        <aside className={`hidden lg:flex relative overflow-hidden ${section}`}>
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#80F9FA]/30 blur-3xl" />
          <div className="absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-[#A6FFFF]/20 blur-3xl" />

          <div className="relative p-10 flex flex-col justify-between min-h-[520px]">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`h-12 w-12 rounded-2xl bg-[${BRAND}] text-slate-900 flex items-center justify-center shadow-sm`}>
                  <HospitalLogo />
                </div>
                <div>
                  <div className="text-2xl font-semibold">Inventario TI</div>
                  <div className={`${MUTED} text-sm`}>Hospital · Mesa de Ayuda</div>
                </div>
              </div>
              <p className={`${MUTED} ${baseText}`}>
                Control centralizado de equipos, componentes y periféricos con trazabilidad completa.
              </p>
            </div>

            <ul className="mt-8 space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <Dot /> Auditoría por usuario y acción
              </li>
              <li className="flex items-start gap-2">
                <Dot /> Reportes y tablero ejecutivo
              </li>
              <li className="flex items-start gap-2">
                <Dot /> Flujos de alta, baja y mantenimiento
              </li>
            </ul>

            <div className="mt-10 text-xs text-slate-500">
              © {new Date().getFullYear()} · Soporte TI Hospital
            </div>
          </div>
        </aside>

        {/* Formulario */}
        <main className={card + " " + baseText} role="main" aria-labelledby="login-title">
          <header className="mb-6">
            <div className="flex items-center gap-3">
              <div className={`h-11 w-11 rounded-2xl bg-[${BRAND}] text-slate-900 flex items-center justify-center`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l7 4v6c0 5-3 7-7 10-4-3-7-5-7-10V6l7-4z" />
                </svg>
              </div>
              <div>
                <h1 id="login-title" className="text-[22px] font-semibold">
                  Iniciar sesión
                </h1>
                <p className={`${MUTED} text-sm`}>Usa tus credenciales corporativas</p>
              </div>
            </div>
          </header>

          {msg && (
            <div
              ref={errRef}
              tabIndex={-1}
              className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-300"
              role="alert"
            >
              {msg}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            {/* Usuario */}
            <div>
              <label htmlFor="username" className="block text-sm text-slate-700">
                Usuario
              </label>
              <input
                id="username"
                ref={userRef}
                className={fieldBase + " mt-1"}
                placeholder="ej. jdoe"
                value={username}
                onChange={(e) => setU(e.target.value)}
                onKeyDown={(e) => setCaps(e.getModifierState?.("CapsLock") || false)}
                onKeyUp={(e) => setCaps(e.getModifierState?.("CapsLock") || false)}
              />
            </div>

            {/* Contraseña */}
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm text-slate-700">
                  Contraseña
                </label>
                <span className="text-xs text-slate-500">mín. 4 caracteres</span>
              </div>
              <div className="mt-1 relative">
                <input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  className={fieldBase + " pr-12"}
                  value={password}
                  onChange={(e) => setP(e.target.value)}
                  onKeyDown={(e) => setCaps(e.getModifierState?.("CapsLock") || false)}
                  onKeyUp={(e) => setCaps(e.getModifierState?.("CapsLock") || false)}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-600 hover:bg-slate-100"
                  aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPwd ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {caps && (
                <div className="mt-1 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                  Bloq Mayús está activado
                </div>
              )}
            </div>

            {/* Recordarme */}
            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 select-none">
                <input
                  type="checkbox"
                  className={`h-4 w-4 rounded border-slate-300 text-[${BRAND}] focus:ring-[${BRAND}]/40`}
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Recordarme
              </label>
              <a
                className="text-sm text-slate-600 hover:text-slate-900 underline underline-offset-4"
                href="mailto:soporte@empresa.com"
              >
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            {/* Botón ingresar */}
            <button className={btnPrimary + " w-full"} disabled={!canSubmit}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner /> Ingresando…
                </span>
              ) : (
                "Entrar"
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
            <div>
              ¿Problemas para ingresar? Contacta a{" "}
              <a className="text-slate-700 underline" href="mailto:soporte@empresa.com">
                Soporte
              </a>
            </div>
            <Link to="/" className="text-slate-700 underline">
              Volver al inicio
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ===== Íconos ===== */
function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
function Dot() {
  return <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-[#80F9FA]" />;
}
function HospitalLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 100 20 10 10 0 000-20Zm1 5v4h4v2h-4v4h-2v-4H7v-2h4V7h2Z" />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M3 3l18 18M10.6 10.6A3.5 3.5 0 0012 15.5c1.9 0 3.5-1.6 3.5-3.5 0-.5-.1-1-.3-1.4M7.5 7.9C5 9 3 12 3 12s4 7 9 7c2 0 3.7-.6 5.1-1.5M16.4 7.6C15.3 7.2 13.9 7 12 7 5 7 1 12 1 12s1.1 2 3 3.6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
