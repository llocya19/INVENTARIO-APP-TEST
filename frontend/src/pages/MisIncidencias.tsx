import { useEffect, useMemo, useState } from "react";
import {
  listarMisIncidencias,
  crearIncidencia,
  agregarMensaje,
  obtenerIncidencia,
  type Incidencia,
} from "../api/incidencias";
import { getProfile, updateEmail } from "../api/profile";
import { getUser } from "../services/authService"; // ⬅ traer rol
import IncidenciaNotifier from "@/components/widgets/IncidenciaNotifier";

/* ====== Tokens visuales ====== */
const section = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const fieldBase =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] placeholder-slate-400 " +
  "focus:outline-none focus:ring-2 focus:ring-[#80F9FA]/40 focus:border-[#80F9FA]/60 transition";

/* Botón con tema turquesa */
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

export default function MisIncidencias() {
  // === rol actual para condicionar UI ===
  const me = getUser();
  const rol = (me?.rol || "USUARIO").toUpperCase();
  const isAdmin = rol === "ADMIN";
  const isPract = rol === "PRACTICANTE";
  const isUser = rol === "USUARIO";

  const [page, setPage] = useState(1);
  const [size] = useState(10);
  const [rows, setRows] = useState<Incidencia[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [email, setEmail] = useState<string>("");
  const [haveEmail, setHaveEmail] = useState<boolean>(true);
  const [savingMail, setSavingMail] = useState(false);

  const [showNew, setShowNew] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [desc, setDesc] = useState("");
  const [equipoId, setEquipoId] = useState<number | "">("");

  const [sel, setSel] = useState<(Incidencia & { mensajes: any[] }) | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  // Solo soporte (visible para practicante/admin)
  const [soloStaff, setSoloStaff] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / size)), [total, size]);

  async function load() {
    setMsg(null);
    setLoading(true);
    try {
      const data = await listarMisIncidencias({ page, size });
      setRows(data.items);
      setTotal(data.total);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo cargar tus incidencias.");
    } finally {
      setLoading(false);
    }
  }

  async function loadProfile() {
    try {
      const p = await getProfile();
      setHaveEmail(!!p.email);
      setEmail(p.email || "");
    } catch {}
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);
  useEffect(() => {
    loadProfile();
  }, []);

  async function saveEmail() {
    if (!email || !email.includes("@")) {
      setMsg("Ingresa un correo válido.");
      return;
    }
    setSavingMail(true);
    try {
      await updateEmail(email.trim());
      setHaveEmail(true);
      setMsg("Correo guardado.");
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo guardar el correo.");
    } finally {
      setSavingMail(false);
    }
  }

  async function crear() {
    if (!titulo.trim() || !desc.trim()) {
      setMsg("Completa título y descripción.");
      return;
    }
    setMsg(null);
    try {
      await crearIncidencia({
        titulo: titulo.trim(),
        descripcion: desc.trim(),
        equipo_id: equipoId ? Number(equipoId) : undefined,
      });
      setShowNew(false);
      setTitulo("");
      setDesc("");
      setEquipoId("");
      await load();
      setMsg("Incidencia creada correctamente.");
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo crear la incidencia.");
    }
  }

  async function open(id: number) {
    const d = await obtenerIncidencia(id);
    setSel(d as any);
    setNote("");
    setSoloStaff(false);
  }

  async function addNote() {
    if (!sel || !note.trim()) return;
    try {
      setSending(true);
      // Para practicante/admin, enviar bandera solo_staff
      const opts = (isAdmin || isPract) ? { solo_staff: soloStaff } : undefined;
      await agregarMensaje(sel.inc_id, note.trim(), opts as any);
      setNote("");
      setSoloStaff(false);
      await open(sel.inc_id);
      window.dispatchEvent(
        new CustomEvent("inc:new_msg", {
          detail: { inc_id: sel.inc_id, created_at: new Date().toISOString() },
        })
      );
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{ inc_id: number }>;
      if (sel && e.detail?.inc_id === sel.inc_id) {
        open(sel.inc_id);
      }
    };
    window.addEventListener("inc:new_msg", handler as EventListener);
    return () => window.removeEventListener("inc:new_msg", handler as EventListener);
  }, [sel]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-5 space-y-5">
      <div className={`${section} px-4 py-4 md:px-6 md:py-5`}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-[22px] md:text-[26px] font-semibold">
              {isUser ? "Mis incidencias" : "Incidencias"}
            </h2>
            <p className="text-slate-600 text-sm">
              {isUser ? "Crea nuevas incidencias y conversa con Soporte." : "Conversa con Soporte sobre tus incidencias asignadas/creadas."}
            </p>
          </div>

          {/* Ocultar “+ Nueva” para practicante/admin */}
          {isUser && (
            <Button onClick={() => setShowNew(true)}>+ Nueva</Button>
          )}
        </div>
      </div>

      {!haveEmail && isUser && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50">
          <div className="text-sm font-medium mb-1">Falta tu email de contacto</div>
          <div className="flex gap-2 items-center">
            <input
              className={fieldBase + " flex-1"}
              placeholder="tu@correo.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button onClick={saveEmail} disabled={savingMail}>
              {savingMail ? "Guardando…" : "Guardar"}
            </Button>
          </div>
          <div className="text-xs text-slate-600 mt-1">
            Solo se pide la primera vez. Luego podrás editarlo en Perfil.
          </div>
        </div>
      )}

      {msg && (
        <div className="p-3 rounded-xl border border-[#80F9FA]/30 bg-[#80F9FA]/10 text-[#066B6B]">
          {msg}
        </div>
      )}

      <div className={section}>
        <div className="divide-y">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={`sk-${i}`} className="p-4 space-y-2">
                <div className="h-3 w-1/3 rounded bg-slate-200/70 animate-pulse" />
                <div className="h-3 w-2/3 rounded bg-slate-200/70 animate-pulse" />
              </div>
            ))
          ) : rows.length === 0 ? (
            <div className="p-6 text-center text-slate-500">Aún no hay incidencias.</div>
          ) : (
            rows.map((r) => (
              <div
                key={r.inc_id}
                className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/60"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium truncate">{r.titulo}</div>
                    <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] bg-slate-100 text-slate-700">
                      {r.estado}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600 truncate">
                    #{r.inc_id} · {r.equipo_codigo || "sin equipo"}
                  </div>
                </div>
                <Button variant="secondary" onClick={() => open(r.inc_id)}>
                  Ver
                </Button>
              </div>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="p-3 border-t flex items-center justify-between text-sm">
            <span>
              Página {page} de {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                «
              </Button>
              <Button
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                »
              </Button>
            </div>
          </div>
        )}
      </div>

      {isUser && showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowNew(false)} />
          <div className={`${section} relative w-full max-w-lg`}>
            <div className="px-4 py-3 border-b font-semibold">Nueva incidencia</div>
            <div className="p-4 md:p-5 space-y-3">
              <div>
                <div className="text-slate-600 text-sm mb-1">Título</div>
                <input className={fieldBase} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
              </div>
              <div>
                <div className="text-slate-600 text-sm mb-1">Descripción</div>
                <textarea
                  className={fieldBase}
                  rows={5}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                />
              </div>
              <div>
                <div className="text-slate-600 text-sm mb-1">Equipo (opcional, id)</div>
                <input
                  className={fieldBase}
                  value={equipoId}
                  onChange={(e) => setEquipoId(e.target.value ? Number(e.target.value) : "")}
                />
              </div>
            </div>
            <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowNew(false)}>
                Cancelar
              </Button>
              <Button onClick={crear}>Crear</Button>
            </div>
          </div>
        </div>
      )}

      {sel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSel(null)} />
          <div className={`${section} relative w-full max-w-3xl overflow-hidden`}>
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="font-semibold">Incidencia #{sel.inc_id}</div>
                <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] bg-slate-100 text-slate-700">
                  {sel.estado}
                </span>
              </div>
              <Button variant="secondary" onClick={() => setSel(null)}>
                Cerrar
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:gap-4 p-4 md:p-5">
              <div className="md:col-span-1 space-y-2">
                <div>
                  <div className="text-slate-500 text-xs">Título</div>
                  <div className="font-medium">{sel.titulo}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs">Descripción</div>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">{sel.descripcion}</div>
                </div>
                <div className="text-xs text-slate-500">
                  Equipo: <span className="font-medium">{sel.equipo_codigo || "sin equipo"}</span>
                </div>
              </div>

              <div className="md:col-span-2">
                <div className="text-sm font-medium mb-2">Mensajes</div>
                <div className="space-y-2 h-72 md:h-80 overflow-auto pr-1 rounded-xl border border-slate-200 bg-slate-50/60 p-2">
                  {sel.mensajes?.length ? (
                    sel.mensajes.map((m: any, i: number) => (
                      <div key={i} className="text-sm p-2 rounded-lg bg-white ring-1 ring-slate-200">
                        <div className="flex items-center gap-2">
                          <div className="text-slate-700">{m.mensaje}</div>
                          {m.solo_staff && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                              Privado · soporte
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          {m.usuario} · {new Date(m.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 text-sm p-2">Sin mensajes</div>
                  )}
                </div>

                <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  {(isAdmin || isPract) && (
                    <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                        checked={soloStaff}
                        onChange={(e) => setSoloStaff(e.target.checked)}
                      />
                      Solo soporte (oculta al usuario)
                    </label>
                  )}
                  <input
                    className={fieldBase + " flex-1"}
                    placeholder="Escribe un mensaje…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && addNote()}
                  />
                  <Button onClick={addNote} disabled={sending}>
                    {sending ? "Enviando…" : "Enviar"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <IncidenciaNotifier onOpenIncidencia={(id: number) => open(id)} />
    </div>
  );
}
