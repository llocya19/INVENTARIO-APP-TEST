// frontend/src/pages/Profile.tsx
import { useEffect, useState } from "react";
import { getProfile, updateEmail, sendTestMail } from "../api/profile";

/* =========================
   Estilo visual institucional
========================= */
const section = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const fieldBase =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] placeholder-slate-400 " +
  "focus:outline-none focus:ring-2 focus:ring-[#80F9FA]/40 focus:border-[#80F9FA]/60 transition";

function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }
) {
  const { variant = "primary", className = "", ...rest } = props;
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[15px] transition min-h-[40px] font-medium disabled:opacity-50 disabled:cursor-not-allowed";
  const map = {
    primary: "bg-[#80F9FA] text-slate-900 hover:bg-[#6DE2E3] active:bg-[#5FD0D1] shadow-sm",
    secondary: "bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 active:bg-slate-100",
  };
  return <button className={`${base} ${map[variant]} ${className}`} {...rest} />;
}

/* =========================
   Página de perfil de usuario
========================= */
export default function Profile() {
  const [email, setEmail] = useState("");
  const [user, setUser] = useState<{ username: string; rol: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const p = await getProfile();
      setUser({ username: p.username, rol: p.rol });
      setEmail(p.email || "");
    } catch (e) {
      setMsg("No se pudo cargar el perfil.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!email.trim() || !email.includes("@")) {
      setMsg("Por favor ingresa un correo válido.");
      return;
    }
    setMsg(null);
    try {
      await updateEmail(email.trim());
      setMsg("✅ Correo actualizado correctamente.");
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo actualizar el correo.");
    }
  }

  async function test() {
    setMsg(null);
    try {
      await sendTestMail();
      setMsg("✉️ Correo de prueba enviado correctamente.");
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo enviar el correo de prueba.");
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <h2 className="text-[22px] md:text-[26px] font-semibold text-slate-800">Mi perfil</h2>

      {msg && (
        <div className="p-3 rounded-xl border border-[#80F9FA]/30 bg-[#80F9FA]/10 text-[#066B6B]">
          {msg}
        </div>
      )}

      <div className={`${section} p-5 space-y-4`}>
        {loading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-slate-200 rounded w-1/3"></div>
            <div className="h-4 bg-slate-200 rounded w-2/3"></div>
          </div>
        ) : (
          <>
            <div>
              <div className="text-sm text-slate-600">Usuario</div>
              <div className="font-medium text-slate-800">
                {user?.username} · {user?.rol}
              </div>
            </div>

            <div>
              <div className="text-sm text-slate-600">Correo de notificación</div>
              <input
                className={fieldBase + " mt-1"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="midireccion@dominio.com"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button onClick={save}>Guardar</Button>
              <Button variant="secondary" onClick={test}>
                Enviar prueba
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
