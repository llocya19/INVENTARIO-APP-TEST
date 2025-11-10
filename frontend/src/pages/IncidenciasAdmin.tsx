// frontend/src/pages/IncidenciasAdmin.tsx
import { useEffect, useMemo, useState } from "react";
import {
  listarIncidencias,
  obtenerIncidencia,
  asignarPracticante,
  cambiarEstado,
  agregarMensaje,
  type Incidencia,
} from "../api/incidencias";
import http from "../api/http";
import { getUser } from "../services/authService";
import IncidenciaNotifier from "@/components/widgets/IncidenciaNotifier";

/* UI tokens */
const BRAND = "#80F9FA";
const card = "bg-white rounded-2xl shadow-sm ring-1 ring-slate-200";
const pad = "p-4 md:p-5";
const fieldBase =
  `w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm placeholder-slate-400
   focus:outline-none focus:ring-2 focus:ring-[${BRAND}]/40 focus:border-[${BRAND}] transition`;
const selectBase = fieldBase + " pr-8";
const btnBase =
  `inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm
   hover:border-[${BRAND}] hover:bg-[#F0FEFE] active:bg-[#E1FDFD] transition`;
const btnPrimary =
  `inline-flex items-center justify-center rounded-xl bg-[${BRAND}] text-slate-800 px-4 py-2 text-sm shadow-sm
   hover:bg-[#6ee7e9] active:bg-[#4fd4d7] transition disabled:opacity-50 disabled:cursor-not-allowed`;

function BadgeEstado({ value }: { value?: string }) {
  const v = (value || "").toUpperCase();
  const map: Record<string, string> = {
    ABIERTA: "bg-rose-100 text-rose-700",
    EN_PROCESO: "bg-amber-100 text-amber-800",
    // turquesa para CERRADA
    CERRADA: "bg-[#E6FEFF] text-slate-800",
  };
  const cls = map[v] || "bg-slate-100 text-slate-700";
  return <span className={`text-[11px] px-2 py-0.5 rounded-full ${cls}`}>{v || "—"}</span>;
}

type Pract = { id: number; username: string };

export default function IncidenciasAdmin() {
  const me = getUser();
  const rol = me?.rol || "USUARIO";
  const isAdmin = rol === "ADMIN";
  const isPract = rol === "PRACTICANTE";

  const [estado, setEstado] = useState<string>("ABIERTA");
  const [areaId, setAreaId] = useState<number | undefined>();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [size] = useState(10);

  const [rows, setRows] = useState<Incidencia[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [show, setShow] = useState(false);
  const [sel, setSel] = useState<(Incidencia & { mensajes: any[] }) | null>(null);

  const [practs, setPracts] = useState<Pract[]>([]);
  const [assignUsername, setAssignUsername] = useState<string>("");

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / size)), [total, size]);

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const data = await listarIncidencias({ estado, area_id: areaId, q, page, size });
      setRows(data.items);
      setTotal(data.total);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo cargar");
    } finally {
      setLoading(false);
    }
  }

  async function loadPracts() {
    if (!isAdmin) return;
    try {
      const r = await http.get<{ items?: Pract[] } | Pract[]>("/api/users", { params: { rol: "PRACTICANTE" } });
      const arr = Array.isArray(r.data) ? (r.data as Pract[]) : (r.data.items ?? []);
      setPracts(arr);
    } catch {
      /* no-op */
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, areaId, q, page]);
  useEffect(() => {
    loadPracts();
  }, []);

  async function openDetail(id: number) {
    setMsg(null);
    try {
      const d = await obtenerIncidencia(id);
      setSel(d as any);
      setAssignUsername("");
      setShow(true);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo abrir el detalle");
    }
  }

  // === Escucha evento global para refrescar el hilo si está abierto ===
  useEffect(() => {
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{ inc_id: number }>;
      if (!show || !sel) return;
      if (e.detail?.inc_id === sel.inc_id) {
        openDetail(sel.inc_id); // recarga mensajes del hilo abierto
      }
    };
    window.addEventListener("inc:new_msg", handler as EventListener);
    return () => window.removeEventListener("inc:new_msg", handler as EventListener);
  }, [show, sel]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl md:text-2xl font-semibold">
          {isAdmin ? "Incidencias (Admin)" : isPract ? "Incidencias asignadas" : "Incidencias"}
        </h2>
        <button className={btnBase + " w-full sm:w-auto"} onClick={load} disabled={loading}>
          {loading ? "Actualizando…" : "Refrescar"}
        </button>
      </div>

      <div className={`${card} ${pad}`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <div className="text-sm text-slate-600 mb-1">Estado</div>
            <select
              value={estado}
              onChange={(e) => {
                setPage(1);
                setEstado(e.target.value);
              }}
              className={selectBase}
            >
              <option value="ABIERTA">ABIERTA</option>
              <option value="EN_PROCESO">EN_PROCESO</option>
              <option value="CERRADA">CERRADA</option>
              <option value="">— Todos —</option>
            </select>
          </div>

          {!isPract && (
            <div>
              <div className="text-sm text-slate-600 mb-1">Área (ID)</div>
              <input
                className={fieldBase}
                placeholder="Ej. 9"
                value={areaId ?? ""}
                onChange={(e) => setAreaId(e.target.value ? Number(e.target.value) : undefined)}
                inputMode="numeric"
              />
            </div>
          )}

          <div className="md:col-span-2">
            <div className="text-sm text-slate-600 mb-1">Buscar</div>
            <div className="flex items-center gap-2">
              <input
                className={fieldBase + " flex-1"}
                placeholder="código equipo, título, usuario…"
                value={q}
                onChange={(e) => {
                  setPage(1);
                  setQ(e.target.value);
                }}
              />
              <button className={btnPrimary + " shrink-0"} onClick={load}>
                Buscar
              </button>
            </div>
          </div>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded-xl bg-[#E6FEFF] text-slate-800 ring-1 ring-[${BRAND}]/50`}>
          {msg}
        </div>
      )}

      <div className={card}>
        <div className="px-4 py-2 border-b text-sm text-slate-600 flex items-center justify-between">
          <span>Total: {total}</span>
          <span className="text-xs text-slate-500">
            Página {page} / {totalPages}
          </span>
        </div>

        <div className="divide-y">
          {loading ? (
            <div className="p-4 text-sm text-slate-600">Cargando…</div>
          ) : rows.length === 0 ? (
            <div className="p-4 text-slate-500">Sin resultados</div>
          ) : (
            rows.map((r) => (
              <div key={r.inc_id} className="p-3 md:p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium truncate">{r.titulo}</div>
                    <BadgeEstado value={r.estado} />
                  </div>
                  <div className="text-sm text-slate-600 truncate">
                    <span className="font-mono">#{r.inc_id}</span> · {r.area_nombre || "—"} · {r.equipo_codigo || "sinequipo"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className={btnPrimary} onClick={() => openDetail(r.inc_id)}>
                    Ver
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="px-3 md:px-4 py-3 border-t flex items-center justify-between text-sm">
            <span>
              Página {page} de {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                className={`${btnBase} disabled:opacity-50`}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ◀
              </button>
              <button
                disabled={page >= totalPages}
                className={`${btnBase} disabled:opacity-50`}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                ▶
              </button>
            </div>
          </div>
        )}
      </div>

      {show && sel && (
        <IncidenciaDetail
          inc={sel}
          isAdmin={isAdmin}
          isPract={isPract}
          practs={practs}
          assignUsername={assignUsername}
          onAssignUsername={setAssignUsername}
          onClose={() => setShow(false)}
          onRefresh={load}
        />
      )}

      {/* Notificador global: muestra burbuja y abre el hilo al tocar */}
      <IncidenciaNotifier onOpenIncidencia={(id) => openDetail(id)} />
    </div>
  );
}

/* =========================
   Detalle
========================= */
function IncidenciaDetail({
  inc,
  isAdmin,
  isPract,
  practs,
  assignUsername,
  onAssignUsername,
  onClose,
  onRefresh,
}: {
  inc: Incidencia & { mensajes: any[] };
  isAdmin: boolean;
  isPract: boolean;
  practs: { id: number; username: string }[];
  assignUsername: string;
  onAssignUsername: (v: string) => void;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [soloStaff, setSoloStaff] = useState(false);

  async function doAssign() {
    if (!assignUsername) return;
    setMsg(null);
    try {
      await asignarPracticante(inc.inc_id, assignUsername);
      await onRefresh();
      setMsg("Asignado");
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo asignar");
    }
  }

  async function setEstadoBtn(e: Incidencia["estado"]) {
    setMsg(null);
    try {
      await cambiarEstado(inc.inc_id, e);
      await onRefresh();
      setMsg("Estado actualizado");
    } catch (er: any) {
      setMsg(er?.response?.data?.error || "No se pudo cambiar estado");
    }
  }

  async function addNote() {
    if (!note.trim()) return;
    setMsg(null);
    try {
      await agregarMensaje(inc.inc_id, note.trim(), {
        solo_staff: (isAdmin || isPract) ? soloStaff : false,
      });
      setNote("");
      setSoloStaff(false);
      await onRefresh();
      setMsg("Mensaje agregado");
      // Emite evento para que otras vistas refresquen si tienen ese hilo abierto
      window.dispatchEvent(
        new CustomEvent("inc:new_msg", {
          detail: { inc_id: inc.inc_id, created_at: new Date().toISOString() },
        })
      );
    } catch (er: any) {
      setMsg(er?.response?.data?.error || "No se pudo agregar mensaje");
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:w-[760px]">
        <div className={`${card} overflow-hidden mx-3 sm:mx-0`}>
          <div className="px-4 py-3 border-b bg-white flex items-center justify-between sticky top-0">
            <div className="font-semibold">
              Incidencia <span className="font-mono">#{inc.inc_id}</span>
            </div>
            <button className={btnBase} onClick={onClose}>
              Cerrar
            </button>
          </div>

          <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
            {msg && (
              <div className={`p-3 rounded-xl bg-[#E6FEFF] text-slate-800 ring-1 ring-[${BRAND}]/50`}>
                {msg}
              </div>
            )}

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-lg font-medium">{inc.titulo}</div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {inc.estado}
                </span>
              </div>
              <div className="text-sm text-slate-600">{inc.descripcion}</div>
              <div className="text-xs text-slate-500">
                {inc.area_nombre || "—"} · {inc.equipo_codigo || "sin equipo"}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isAdmin && (
                <div className="rounded-xl ring-1 ring-slate-200 p-3">
                  <div className="text-sm text-slate-600 mb-1">Asignar a practicante</div>
                  <div className="flex items-center gap-2">
                    <select
                      className={selectBase}
                      value={assignUsername}
                      onChange={(e) => onAssignUsername(e.target.value)}
                    >
                      <option value="">— Seleccione —</option>
                      {practs.map((p) => (
                        <option key={p.id} value={p.username}>
                          {p.username}
                        </option>
                      ))}
                    </select>
                    <button className={btnPrimary} onClick={doAssign}>
                      Asignar
                    </button>
                  </div>
                </div>
              )}

              <div className="rounded-xl ring-1 ring-slate-200 p-3">
                <div className="text-sm text-slate-600 mb-1">Estado</div>
                <div className="flex flex-wrap items-center gap-2">
                  {isAdmin && (
                    <button onClick={() => setEstadoBtn("ABIERTA")} className={btnBase}>
                      ABIERTA
                    </button>
                  )}
                  <button onClick={() => setEstadoBtn("EN_PROCESO")} className={btnBase}>
                    EN_PROCESO
                  </button>
                  {isAdmin ? (
                    <button onClick={() => setEstadoBtn("CERRADA")} className={btnBase}>
                      CERRADA
                    </button>
                  ) : (
                    <button className={`${btnBase} opacity-50 cursor-not-allowed`} title="Solo Admin">
                      CERRADA
                    </button>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  * Una vez CERRADA, ya no se puede modificar.
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">Mensajes</div>
              <div className="space-y-2 max-h-60 overflow-auto pr-1">
                {inc.mensajes?.length ? (
                  inc.mensajes.map((m: any) => (
                    <div
                      key={m.msg_id ?? m.created_at}
                      className="text-sm p-2 rounded-lg bg-slate-50 ring-1 ring-slate-200"
                    >
                      <div className="flex items-center gap-2">
                        <div className="text-slate-700 whitespace-pre-wrap break-words flex-1">
                          {m.mensaje}
                        </div>
                        {m.solo_staff && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 shrink-0">
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
                  <div className="text-slate-500 text-sm">Sin mensajes</div>
                )}
              </div>

              <div className="flex items-center gap-2 mt-2 flex-wrap">
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
                  className={fieldBase + " flex-1 min-w-[220px]"}
                  placeholder="Añadir mensaje…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addNote()}
                />
                <button className={btnPrimary} onClick={addNote}>
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="h-3 sm:hidden" />
      </div>
    </div>
  );
}
