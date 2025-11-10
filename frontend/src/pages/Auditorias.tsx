// src/pages/Auditorias.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import http from "../api/http";
import type { JSX } from "react/jsx-runtime";

// UI unificada
import Button from "../components/ui/Button";
import {
  container,
  surfaceSection,
  surfaceCard,
  fieldBase as fieldBaseToken,
} from "../components/ui/tokens";

/* =========================
   Tipos
========================= */
type MovRow = {
  mov_id: number;
  mov_item_id: number | null;
  item_codigo: string | null;
  clase: "COMPONENTE" | "PERIFERICO" | null;
  item_tipo: string | null;
  mov_tipo: string;
  mov_fecha: string; // ISO
  mov_origen_area_id: number | null;
  origen_area_nombre: string | null;
  mov_destino_area_id: number | null;
  destino_area_nombre: string | null;
  mov_equipo_id: number | null;
  equipo_codigo: string | null;
  equipo_nombre: string | null;
  mov_usuario_app: string | null;
  mov_motivo: string | null;
  mov_detalle: any; // json
  es_audit?: boolean;
};
type MovPage = { items: MovRow[]; total: number; page: number; size: number };
type Fuente = "mov" | "audit" | "both";

/* =========================
   Tema / helpers UI
========================= */
const BG_APP = "bg-[#FFFCF3]";
const TEXT = "text-slate-800";
const MUTED = "text-slate-600";
const baseText = "leading-relaxed tracking-[0.01em]";
const fieldBase = `${fieldBaseToken} text-[15px]`;

function Icon({
  name,
  className = "h-4 w-4",
}: {
  name:
    | "back"
    | "refresh"
    | "chevL"
    | "chevR"
    | "filter"
    | "x"
    | "search"
    | "calendar"
    | "info"
    | "arrowR";
  className?: string;
}) {
  const map: Record<string, JSX.Element> = {
    back: (
      <svg viewBox="0 0 24 24" className={className} fill="none">
        <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    refresh: (
      <svg viewBox="0 0 24 24" className={className} fill="none">
        <path d="M4 4v6h6M20 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M20 9a8 8 0 10-1.7 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    chevL: (
      <svg viewBox="0 0 24 24" className={className} fill="none">
        <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    chevR: (
      <svg viewBox="0 0 24 24" className={className} fill="none">
        <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    filter: (
      <svg viewBox="0 0 24 24" className={className} fill="none">
        <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    x: (
      <svg viewBox="0 0 24 24" className={className} fill="none">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    search: (
      <svg viewBox="0 0 24 24" className={className} fill="none">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="M20 20l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    calendar: (
      <svg viewBox="0 0 24 24" className={className} fill="none">
        <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M16 3v4M8 3v4M3 9h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    info: (
      <svg viewBox="0 0 24 24" className={className} fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <path d="M12 8h.01M11 12h2v4h-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    arrowR: (
      <svg viewBox="0 0 24 24" className={className} fill="none">
        <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  };
  return map[name];
}

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "sky" | "violet" | "amber" | "emerald" | "rose" | "orange";
}) {
  const map = {
    slate: "bg-slate-100 text-slate-700",
    sky: "bg-sky-100 text-sky-700",
    violet: "bg-violet-100 text-violet-700",
    amber: "bg-amber-100 text-amber-800",
    emerald: "bg-emerald-100 text-emerald-700",
    rose: "bg-rose-100 text-rose-700",
    orange: "bg-orange-100 text-orange-700",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] ${map[tone]}`}>{children}</span>
  );
}

function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="text-center py-10">
      <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
        <Icon name="info" className="h-5 w-5" />
      </div>
      <div className="font-medium text-slate-700">{title}</div>
      {hint && <div className="text-sm text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

/* =========================
   Helpers de formato
========================= */
function formatDT(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso ?? "-";
  return d.toLocaleString();
}

function toneByMovTipo(t: string): Parameters<typeof Badge>[0]["tone"] {
  const k = t?.toUpperCase() || "";
  if (["ASIGNACION", "RETORNO"].includes(k)) return "emerald";
  if (["TRASLADO"].includes(k)) return "sky";
  if (["REPARACION"].includes(k)) return "orange";
  if (["ENTRADA"].includes(k)) return "amber";
  if (["RETIRO", "BAJA"].includes(k)) return "rose";
  return "slate";
}

/* =========================
   Página
========================= */
export default function AuditoriasPage() {
  const navigate = useNavigate();

  const [page, setPage] = useState<MovPage>({ items: [], total: 0, page: 1, size: 20 });
  const [fuente, setFuente] = useState<Fuente>("mov");
  const [tipoMov, setTipoMov] = useState<string>("");
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");
  const [q, setQ] = useState<string>("");

  const [detailOpen, setDetailOpen] = useState<null | MovRow>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((page.total || 0) / (page.size || 20))),
    [page.total, page.size]
  );

  async function load(p = 1, s = page.size) {
    setLoading(true);
    setErr(null);
    try {
      const params: any = { page: p, size: s, fuente };
      if (fuente === "mov" && tipoMov) params.tipo = tipoMov;
      if (desde) params.desde = desde;
      if (hasta) params.hasta = hasta;
      if (q) params.q = q;

      const r = await http.get<MovPage>("/api/movimientos", { params });
      setPage({
        items: r.data.items || [],
        total: Number(r.data.total || 0),
        page: Number(r.data.page || p),
        size: Number(r.data.size || s),
      });
    } catch (e: any) {
      setErr(e?.response?.data?.error || "No se pudo cargar la auditoría");
    } finally {
      setLoading(false);
    }
  }

  // Rango rápido
  function setRango(days: number) {
    const now = new Date();
    const end = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const start = new Date(end);
    start.setUTCDate(end.getUTCDate() - (days - 1));
    const toISODate = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
        d.getUTCDate()
      ).padStart(2, "0")}`;
    setDesde(toISODate(start));
    setHasta(toISODate(end));
  }

  function limpiar() {
    setTipoMov("");
    setDesde("");
    setHasta("");
    setQ("");
  }

  // Cargar en cambios de fuente
  useEffect(() => {
    load(1, page.size);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuente]);

  // Debounce búsqueda
  useEffect(() => {
    const t = setTimeout(() => {
      load(1, page.size);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className={`${BG_APP} ${TEXT} min-h-[calc(100vh-64px)]`}>
      <div className={`${container} py-5 space-y-5`}>
        {/* App bar */}
        <div className={`${surfaceSection} px-4 py-4 md:px-6 md:py-5 ${baseText}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Button
                variant="secondary"
                onClick={() =>
                  window.history.length > 1 ? navigate(-1) : navigate("/")
                }
                title="Volver"
              >
                <Icon name="back" /> Atrás
              </Button>
              <div>
                <div className="text-[22px] md:text-[26px] font-semibold">Auditoría</div>
                <div className={MUTED + " text-sm"}>
                  Lista clara de movimientos y auditorías, con detalles organizados.
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => load(page.page, page.size)} title="Recargar">
                <Icon name="refresh" /> Recargar
              </Button>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className={`${surfaceCard} p-4 md:p-5 ${baseText}`}>
          <div className="flex items-center gap-2 mb-3 text-slate-700">
            <Icon name="filter" />
            <span className="text-sm font-medium">Filtros</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Fuente - segmented (turquesa) */}
            <div className="lg:col-span-4">
              <div className={MUTED + " text-sm mb-1"}>Fuente</div>
              <div className="inline-flex rounded-xl overflow-hidden border border-[#80F9FA] divide-x divide-[#80F9FA]">
                <button
                  onClick={() => setFuente("both")}
                  className={`px-4 py-2 text-[15px] transition ${
                    fuente === "both"
                      ? "bg-[#80F9FA] text-slate-900 hover:bg-[#6DE2E3] active:bg-[#5FD0D1]"
                      : "bg-white text-slate-800 hover:bg-[#E0FEFF]"
                  }`}
                >
                  Mov + Audit
                </button>
                <button
                  onClick={() => setFuente("mov")}
                  className={`px-4 py-2 text-[15px] transition ${
                    fuente === "mov"
                      ? "bg-[#80F9FA] text-slate-900 hover:bg-[#6DE2E3] active:bg-[#5FD0D1]"
                      : "bg-white text-slate-800 hover:bg-[#E0FEFF]"
                  }`}
                >
                  Solo Mov
                </button>
                <button
                  onClick={() => setFuente("audit")}
                  className={`px-4 py-2 text-[15px] transition ${
                    fuente === "audit"
                      ? "bg-[#80F9FA] text-slate-900 hover:bg-[#6DE2E3] active:bg-[#5FD0D1]"
                      : "bg-white text-slate-800 hover:bg-[#E0FEFF]"
                  }`}
                >
                  Solo Audit
                </button>
              </div>
            </div>

            {/* Tipo (solo MOV) */}
            <div className="lg:col-span-2">
              <div className={MUTED + " text-sm mb-1"}>Tipo (solo MOV)</div>
              <select
                className={fieldBase}
                value={tipoMov}
                onChange={(e) => setTipoMov(e.target.value)}
                disabled={fuente !== "mov"}
              >
                <option value="">(Todos)</option>
                <option value="ASIGNACION">ASIGNACION</option>
                <option value="RETIRO">RETIRO</option>
                <option value="ENTRADA">ENTRADA</option>
                <option value="TRASLADO">TRASLADO</option>
                <option value="BAJA">BAJA</option>
                <option value="REPARACION">REPARACION</option>
                <option value="RETORNO">RETORNO</option>
                <option value="EQUIPO_ESTADO">EQUIPO_ESTADO</option>
                <option value="EQUIPO_USUARIO_FINAL">EQUIPO_USUARIO_FINAL</option>
              </select>
            </div>

            {/* Desde / Hasta */}
            <div className="lg:col-span-2">
              <div className={MUTED + " text-sm mb-1"}>Desde</div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Icon name="calendar" />
                </span>
                <input
                  type="date"
                  className={fieldBase + " pl-10"}
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                />
              </div>
            </div>
            <div className="lg:col-span-2">
              <div className={MUTED + " text-sm mb-1"}>Hasta</div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Icon name="calendar" />
                </span>
                <input
                  type="date"
                  className={fieldBase + " pl-10"}
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                />
              </div>
            </div>

            {/* Buscar */}
            <div className="lg:col-span-2">
              <div className={MUTED + " text-sm mb-1"}>Buscar</div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Icon name="search" />
                </span>
                <input
                  className={fieldBase + " pl-10"}
                  placeholder="item/equipo/usuario/motivo o JSON"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && load(1, page.size)}
                />
                {q && (
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => setQ("")}
                    type="button"
                    title="Limpiar"
                  >
                    <Icon name="x" />
                  </button>
                )}
              </div>
            </div>

            {/* Acciones */}
            <div className="lg:col-span-12 flex flex-wrap gap-2 justify-between items-end mt-1">
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setRango(1)}>
                  Hoy
                </Button>
                <Button variant="secondary" onClick={() => setRango(7)}>
                  Últimos 7 días
                </Button>
                <Button variant="secondary" onClick={() => setRango(30)}>
                  Últimos 30 días
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => load(1, page.size)}>
                  Aplicar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    limpiar();
                    load(1, page.size);
                  }}
                >
                  Limpiar
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Errores / Cargando */}
        {err && <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800">{err}</div>}
        {loading && (
          <div className="p-3 rounded-xl border border-slate-200 bg-white text-slate-600">
            Cargando…
          </div>
        )}

        {/* ======= Lista Mobile (tarjetas) ======= */}
        <div className="grid gap-3 md:hidden">
          {page.items.map((r) => {
            const tone = toneByMovTipo(r.mov_tipo);
            return (
              <div key={`${r.mov_id}-${r.es_audit ? "A" : "M"}`} className={`${surfaceSection} p-3`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-slate-500">{formatDT(r.mov_fecha)}</div>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <Badge tone={tone}>{r.mov_tipo}</Badge>
                      {r.es_audit ? <Badge tone="violet">AUDIT</Badge> : <Badge tone="sky">MOV</Badge>}
                    </div>
                  </div>
                  <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setDetailOpen(r)}>
                    ver…
                  </Button>
                </div>

                <div className="mt-3 grid gap-2 text-[13px]">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Item:</span>
                    <span className="font-mono">{r.item_codigo || "-"}</span>
                    {r.mov_item_id && <span className="text-slate-400">· #{r.mov_item_id}</span>}
                    {(r.clase || r.item_tipo) && (
                      <span className="ml-auto text-slate-500">
                        {r.clase || "-"} {r.item_tipo ? `· ${r.item_tipo}` : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Equipo:</span>
                    <span className="font-mono">{r.equipo_codigo || "-"}</span>
                    {r.mov_equipo_id && <span className="text-slate-400">· #{r.mov_equipo_id}</span>}
                  </div>
                  {r.equipo_nombre && (
                    <div className="text-slate-500">“{r.equipo_nombre}”</div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Ruta:</span>
                    <span>{r.origen_area_nombre || "-"}</span>
                    <Icon name="arrowR" className="h-3.5 w-3.5" />
                    <span>{r.destino_area_nombre || "-"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Usuario:</span>
                    <span>{r.mov_usuario_app || "-"}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-slate-500">Motivo:</span>
                    <span className="line-clamp-2">{r.mov_motivo || "—"}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {page.items.length === 0 && !loading && (
            <EmptyState title="Sin registros" hint="Ajusta filtros o rango de fechas." />
          )}
        </div>

        {/* ======= Tabla Desktop ======= */}
        <div className={`${surfaceSection} overflow-x-auto hidden md:block`}>
          <table className="min-w-full table-fixed">
            <colgroup>
              <col className="w-[160px]" />
              <col className="w-[160px]" />
              <col className="w-[200px]" />
              <col className="w-[220px]" />
              <col className="w-[240px]" />
              <col className="w-[140px]" />
              <col className="w-[240px]" />
              <col className="w-[90px]" />
            </colgroup>
            <thead className="bg-slate-50 text-[13px] text-slate-600 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Fecha</th>
                <th className="px-3 py-2 text-left font-medium">Tipo / Fuente</th>
                <th className="px-3 py-2 text-left font-medium">Item</th>
                <th className="px-3 py-2 text-left font-medium">Equipo</th>
                <th className="px-3 py-2 text-left font-medium">Origen → Destino</th>
                <th className="px-3 py-2 text-left font-medium">Usuario</th>
                <th className="px-3 py-2 text-left font-medium">Motivo</th>
                <th className="px-3 py-2 text-left font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((r, i) => {
                const tone = toneByMovTipo(r.mov_tipo);
                return (
                  <tr
                    key={`${r.mov_id}-${r.es_audit ? "A" : "M"}`}
                    className={`border-t align-top ${i % 2 ? "bg-slate-50/40" : ""} hover:bg-slate-50/80`}
                  >
                    {/* Fecha */}
                    <td className="px-3 py-2">
                      <div className="text-[13px]">{formatDT(r.mov_fecha)}</div>
                    </td>

                    {/* Tipo / Fuente */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge tone={tone}>{r.mov_tipo}</Badge>
                        {r.es_audit ? <Badge tone="violet">AUDIT</Badge> : <Badge tone="sky">MOV</Badge>}
                      </div>
                    </td>

                    {/* Item */}
                    <td className="px-3 py-2">
                      <div className="text-[13px]">
                        <span className="text-slate-500">Código: </span>
                        <span className="font-mono">{r.item_codigo || "-"}</span>
                        {r.mov_item_id && <span className="text-slate-400"> · #{r.mov_item_id}</span>}
                      </div>
                      {(r.clase || r.item_tipo) && (
                        <div className="text-[12px] text-slate-500">
                          {r.clase || "-"} {r.item_tipo ? `· ${r.item_tipo}` : ""}
                        </div>
                      )}
                    </td>

                    {/* Equipo */}
                    <td className="px-3 py-2">
                      <div className="text-[13px]">
                        <span className="text-slate-500">Código: </span>
                        <span className="font-mono">{r.equipo_codigo || "-"}</span>
                        {r.mov_equipo_id && <span className="text-slate-400"> · #{r.mov_equipo_id}</span>}
                      </div>
                      {r.equipo_nombre && (
                        <div className="text-[12px] text-slate-500">“{r.equipo_nombre}”</div>
                      )}
                    </td>

                    {/* Origen → Destino */}
                    <td className="px-3 py-2">
                      <div className="text-[13px] flex items-center gap-2">
                        <span>{r.origen_area_nombre || "-"}</span>
                        <Icon name="arrowR" className="h-3.5 w-3.5" />
                        <span>{r.destino_area_nombre || "-"}</span>
                      </div>
                      <div className="text-[12px] text-slate-400">
                        {r.mov_origen_area_id ? `#${r.mov_origen_area_id}` : "-"}
                        {" → "}
                        {r.mov_destino_area_id ? `#${r.mov_destino_area_id}` : "-"}
                      </div>
                    </td>

                    {/* Usuario */}
                    <td className="px-3 py-2">
                      <div className="text-[13px]">{r.mov_usuario_app || "-"}</div>
                    </td>

                    {/* Motivo */}
                    <td className="px-3 py-2">
                      <div className="text-[13px] line-clamp-2">{r.mov_motivo || "—"}</div>
                    </td>

                    {/* Detalle */}
                    <td className="px-3 py-2">
                      {r.mov_detalle ? (
                        <Button
                          variant="secondary"
                          className="text-[13px] w-full sm:w-auto"
                          onClick={() => setDetailOpen(r)}
                          aria-haspopup="dialog"
                          aria-controls="audit-detail-modal"
                        >
                          ver…
                        </Button>
                      ) : (
                        <span className="text-slate-400 text-[13px]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {page.items.length === 0 && !loading && (
                <tr>
                  <td colSpan={8}>
                    <EmptyState title="Sin registros" hint="Ajusta filtros o rango de fechas." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Paginación */}
          <TablePager
            total={page.total}
            page={page.page}
            size={page.size}
            totalPages={totalPages}
            onPage={(p) => load(p, page.size)}
            onSize={(s) => load(1, s)}
          />
        </div>

        {/* ===== Modal Detalle scrollable / responsive ===== */}
        {detailOpen && (
          <div
            id="audit-detail-modal"
            className="fixed inset-0 bg-black/10 backdrop-blur-[1px] z-50 flex items-stretch md:items-center justify-center p-0 md:p-4"
            role="dialog"
            aria-modal="true"
          >
            {/* En móvil: fullscreen; en md+: caja centrada */}
            <div
              className={`${surfaceSection} w-full h-full md:h-auto md:max-w-3xl md:w-full md:rounded-2xl overflow-hidden flex flex-col`}
            >
              {/* Header fijo */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white/95 backdrop-blur">
                <div className="font-semibold text-[15px]">
                  Detalle #{detailOpen.mov_id}{" "}
                  {detailOpen.es_audit ? <Badge tone="violet">AUDIT</Badge> : <Badge tone="sky">MOV</Badge>}
                </div>
                <Button variant="secondary" onClick={() => setDetailOpen(null)}>
                  Cerrar
                </Button>
              </div>

              {/* Contenido con scroll (ocupa disponible) */}
              <div className="flex-1 overflow-auto p-4 md:p-5">
                <div className="text-sm text-slate-600 mb-2">Fecha: {formatDT(detailOpen.mov_fecha)}</div>
                <div className="text-sm text-slate-600 mb-3">
                  Item: <span className="font-mono">{detailOpen.item_codigo || "-"}</span>{" "}
                  {detailOpen.mov_item_id && <span className="text-slate-400">· #{detailOpen.mov_item_id}</span>}
                </div>

                {/* Área JSON scrollable independiente, con altura máxima */}
                <div className="border border-slate-200 rounded-xl bg-slate-50">
                  <div className="px-3 py-2 border-b border-slate-200 text-[13px] text-slate-600">
                    mov_detalle
                  </div>
                  <div className="max-h-[70vh] md:max-h-[60vh] overflow-auto p-3">
                    <pre className="text-xs leading-relaxed">
                      {JSON.stringify(detailOpen.mov_detalle ?? {}, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================
   Table Pager
========================= */
function TablePager({
  total,
  page,
  size,
  totalPages,
  onPage,
  onSize,
}: {
  total: number;
  page: number;
  size: number;
  totalPages: number;
  onPage: (p: number) => void;
  onSize: (s: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3 items-center justify-between p-3 border-t border-slate-200 bg-white">
      <div className="text-sm text-slate-600">Total: {total.toLocaleString()}</div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <Icon name="chevL" />
        </Button>
        <span className="text-sm">
          Página {page} / {totalPages}
        </span>
        <Button variant="secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          <Icon name="chevR" />
        </Button>
        <select
          className={`${fieldBase} ml-2 w-28 py-2`}
          value={size}
          onChange={(e) => onSize(Number(e.target.value))}
          aria-label="Tamaño de página"
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} / pág
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
