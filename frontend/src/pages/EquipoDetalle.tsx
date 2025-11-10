import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import http from "../api/http";

/* ====================== Tema Hospital (crema + blanco) ====================== */
const BG_APP = "bg-[#FFFDF8]";
const TEXT = "text-slate-800";
const MUTED = "text-slate-600";
const section = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const card = section + " p-4 sm:p-5";
const focusRing =
  "focus:outline-none focus:ring-2 focus:ring-[#80F9FA]/40 focus:border-[#80F9FA]/60";
const fieldBase =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-[15px] " +
  "placeholder-slate-400 " +
  TEXT +
  " " +
  focusRing +
  " transition";

/* =============================== Tipos API =============================== */
type Clase = "COMPONENTE" | "PERIFERICO";

type EquipoHeaderAPI = {
  equipo_id: number;
  equipo_codigo: string;
  equipo_nombre: string;
  area_id: number;
  estado: string;
  usuario_final: string | null;
  login: string | null;
  password: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  items?: EquipoItemAPI[];
};

type EquipoItemAPI = {
  item_id: number;
  item_codigo: string;
  clase: Clase;
  tipo: string;
  estado: string;
};

type ItemDisponible = {
  item_id: number;
  item_codigo: string;
  clase: Clase;
  tipo: string;
  estado: string; // ALMACEN
  created_at?: string | null;
};

type ItemsPage = { items: ItemDisponible[]; total: number; page: number; size: number };
type ItemType = { id: number; clase: Clase; nombre: string };

/* ============================== Botón Turquesa ============================== */
function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "subtle" | "danger";
  }
) {
  const { children, variant = "primary", className = "", ...rest } = props;
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition min-h-[44px]";
  const map = {
    primary:
      "bg-[#80F9FA] text-slate-900 hover:bg-[#6DE2E3] active:bg-[#5FD0D1] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed",
    secondary:
      "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed",
    subtle: "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
  } as const;
  return (
    <button className={`${base} ${map[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

/* ============================== Otros Helpers ============================== */
function Icon({
  name,
  className = "h-4 w-4",
}: {
  name: "chevL" | "chevR" | "close" | "arrowR";
  className?: string;
}) {
  if (name === "chevL")
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  if (name === "chevR")
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
        <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  if (name === "arrowR")
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
        <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BadgeEstado({ estado }: { estado?: string }) {
  const e = (estado || "").toUpperCase();
  const map: Record<string, string> = {
    USO: "bg-[#80F9FA]/30 text-slate-900",
    ALMACEN: "bg-slate-100 text-slate-700",
    MANTENIMIENTO: "bg-amber-100 text-amber-800",
    BAJA: "bg-rose-100 text-rose-700",
  };
  const cls = map[e] || "bg-slate-100 text-slate-700";
  return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{e || "—"}</span>;
}

function EmptyState({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="p-8 text-center">
      <div className="text-slate-700 font-medium">{title}</div>
      {desc && <div className="text-sm text-slate-500 mt-1">{desc}</div>}
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-3 py-3">
        <div className="h-4 w-28 bg-slate-200 rounded" />
      </td>
      <td className="px-3 py-3">
        <div className="h-4 w-24 bg-slate-200 rounded" />
      </td>
      <td className="px-3 py-3">
        <div className="h-4 w-16 bg-slate-200 rounded" />
      </td>
      <td className="px-3 py-3">
        <div className="h-8 w-24 bg-slate-200 rounded" />
      </td>
    </tr>
  );
}

/* ================================= Página ================================ */
export default function EquipoDetalle() {
  const { id } = useParams();
  const equipoId = Number(id);

  const [header, setHeader] = useState<EquipoHeaderAPI | null>(null);
  const [componentes, setComponentes] = useState<EquipoItemAPI[]>([]);
  const [perifericos, setPerifericos] = useState<EquipoItemAPI[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // edición metadatos
  const [edit, setEdit] = useState({
    nombre: "",
    estado: "USO",
    usuario_final: "",
    login: "",
    password: "",
  });

  // panel agregar desde almacén
  const [openAdd, setOpenAdd] = useState(false);
  const [addClase, setAddClase] = useState<Clase>("COMPONENTE");
  const [typesC, setTypesC] = useState<ItemType[]>([]);
  const [typesP, setTypesP] = useState<ItemType[]>([]);
  const addTypeOpts = addClase === "COMPONENTE" ? typesC : typesP;

  const [addFilter, setAddFilter] = useState<{ tipo: string; q: string }>({
    tipo: "",
    q: "",
  });
  const [addPage, setAddPage] = useState<ItemsPage>({
    items: [],
    total: 0,
    page: 1,
    size: 10,
  });

  const areaId = useMemo(() => header?.area_id ?? 0, [header]);
  const isEnUso = ((header?.estado || edit.estado) ?? "").toUpperCase() === "USO";

  /* ------------------------------- Cargas ------------------------------- */
  async function loadDetalle(showOk?: string) {
    setLoading(true);
    setMsg(null);
    try {
      const r = await http.get<EquipoHeaderAPI>(`/api/equipos/${equipoId}`);
      const h = r.data;
      setHeader(h);

      const items = Array.isArray(h.items) ? h.items : [];
      setComponentes(items.filter((i) => i.clase === "COMPONENTE"));
      setPerifericos(items.filter((i) => i.clase === "PERIFERICO"));

      setEdit({
        nombre: h.equipo_nombre || "",
        estado: (h.estado || "USO").toUpperCase(),
        usuario_final: h.usuario_final || "",
        login: h.login || "",
        password: h.password || "",
      });

      if (showOk) setOk(showOk);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo cargar el equipo");
    } finally {
      setLoading(false);
    }
  }

  async function loadStatic() {
    try {
      const [tc, tp] = await Promise.all([
        http.get<ItemType[]>("/api/item-types?clase=COMPONENTE"),
        http.get<ItemType[]>("/api/item-types?clase=PERIFERICO"),
      ]);
      setTypesC(tc.data || []);
      setTypesP(tp.data || []);
    } catch {
      /* ignore */
    }
  }

  async function loadDisponibles(page = 1, size = addPage.size) {
    if (!areaId) return;
    const params: any = { clase: addClase, page, size };
    if (addFilter.tipo) params.tipo = addFilter.tipo;
    if (addFilter.q) params.q = addFilter.q;

    const r = await http.get<ItemsPage>(`/api/areas/${areaId}/items-disponibles`, {
      params,
    });
    setAddPage(r.data || { items: [], total: 0, page, size });
  }

  useEffect(() => {
    if (!Number.isFinite(equipoId) || equipoId <= 0) {
      setMsg("ID de equipo inválido");
      return;
    }
    loadDetalle();
    loadStatic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipoId]);

  useEffect(() => {
    if (openAdd && areaId) loadDisponibles(1, addPage.size);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAdd, addClase, areaId]);

  /* -------------------------------- Acciones ------------------------------- */
  const onPatch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMsg(null);
    setOk(null);
    try {
      await http.patch(`/api/equipos/${equipoId}`, {
        equipo_nombre: edit.nombre?.trim(),
        equipo_estado: edit.estado?.toUpperCase(),
        equipo_usuario_final: edit.usuario_final?.trim() || null,
        equipo_login: edit.login?.trim() || null,
        equipo_password: edit.password?.trim() || null,
      });
      await loadDetalle("Equipo actualizado");
    } catch (er: any) {
      setMsg(er?.response?.data?.error || "No se pudo actualizar");
    }
  };

  const onAddItem = async (it: ItemDisponible) => {
    setMsg(null);
    setOk(null);
    try {
      await http.post(`/api/equipos/${equipoId}/items`, {
        item_id: it.item_id,
        slot: null,
      });
      await loadDetalle("Ítem asignado");
      await loadDisponibles(addPage.page, addPage.size);
    } catch (er: any) {
      setMsg(er?.response?.data?.error || "No se pudo asignar el ítem");
    }
  };

  const onRemoveItem = async (it: EquipoItemAPI) => {
    if (!confirm(`¿Retirar ${it.item_codigo} (${it.tipo}) de este equipo?`)) return;
    setMsg(null);
    setOk(null);
    try {
      await http.delete(`/api/equipos/${equipoId}/items/${it.item_id}`);
      await loadDetalle("Ítem retirado");
      if (openAdd) await loadDisponibles(addPage.page, addPage.size);
    } catch (er: any) {
      setMsg(er?.response?.data?.error || "No se pudo retirar el ítem");
    }
  };

  /* --------------------------------- UI --------------------------------- */
  return (
    <div className={`${BG_APP} ${TEXT} min-h-[calc(100vh-64px)]`}>
      <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 py-5 space-y-5">
        {/* Header */}
        <div className={section + " p-4 sm:p-5"}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[22px] font-semibold">
                  {header?.equipo_nombre || "Equipo"}
                </h1>
                <BadgeEstado estado={header?.estado} />
              </div>
              {header && (
                <div className={`${MUTED} text-sm flex items-center gap-2 flex-wrap`}>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    Área ID {header.area_id}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="font-mono">{header.equipo_codigo}</span>
                  <span className="text-slate-400">·</span>
                  <span>
                    Creado:{" "}
                    <b>
                      {header?.created_at
                        ? new Date(header.created_at).toLocaleString()
                        : "-"}
                    </b>
                  </span>
                  <span className="text-slate-400">·</span>
                  <span>
                    Modificado:{" "}
                    <b>
                      {header?.updated_at
                        ? new Date(header.updated_at).toLocaleString()
                        : "-"}
                    </b>
                  </span>
                </div>
              )}
            </div>
            {header && (
              <Link
                to={`/areas/${header.area_id}`}
                className="inline-flex items-center justify-center rounded-xl bg-[#80F9FA] text-slate-900 px-4 py-3 text-sm shadow-sm hover:bg-[#6DE2E3]"
              >
                Volver al área
              </Link>
            )}
          </div>
        </div>

        {msg && (
          <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800">
            {msg}
          </div>
        )}
        {ok && (
          <div className="p-3 rounded-xl border border-emerald-200 bg-[#E6FFFE] text-slate-900">
            {ok}
          </div>
        )}

        {/* Metadatos equipo */}
        <form onSubmit={onPatch} className={card}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <div>
              <div className="text-sm text-slate-600 mb-1">Nombre</div>
              <input
                className={fieldBase}
                value={edit.nombre}
                onChange={(e) => setEdit((s) => ({ ...s, nombre: e.target.value }))}
              />
            </div>
            <div>
              <div className="text-sm text-slate-600 mb-1">Estado</div>
              <select
                className={fieldBase}
                value={edit.estado}
                onChange={(e) => setEdit((s) => ({ ...s, estado: e.target.value }))}
              >
                <option value="ALMACEN">ALMACEN</option>
                <option value="USO">USO</option>
                <option value="MANTENIMIENTO">MANTENIMIENTO</option>
                <option value="BAJA">BAJA</option>
              </select>
            </div>
            <div>
              <div className="text-sm text-slate-600 mb-1">Usuario final</div>
              <input
                className={fieldBase}
                value={edit.usuario_final}
                onChange={(e) =>
                  setEdit((s) => ({ ...s, usuario_final: e.target.value }))
                }
              />
            </div>
            <div>
              <div className="text-sm text-slate-600 mb-1">Login</div>
              <input
                className={fieldBase}
                value={edit.login}
                onChange={(e) => setEdit((s) => ({ ...s, login: e.target.value }))}
              />
            </div>
            <div>
              <div className="text-sm text-slate-600 mb-1">Password</div>
              <input
                type="password"
                className={fieldBase}
                value={edit.password}
                onChange={(e) => setEdit((s) => ({ ...s, password: e.target.value }))}
                autoComplete="new-password"
              />
            </div>
            <div className="md:self-end">
              <Button type="submit" variant="primary" className="w-full md:w-auto">
                Guardar cambios
              </Button>
            </div>
          </div>
        </form>

        {/* Aviso si no está en USO */}
        {header && !isEnUso && (
          <div className="p-3 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-sm">
            Para agregar ítems <b>en USO</b>, cambia el estado del equipo a <b>USO</b> y
            guarda.
          </div>
        )}

        {/* Acciones rápidas */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-lg font-semibold">
            Componentes & Periféricos asignados
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setOpenAdd(true)}
              disabled={!header}
              title="Asignar ítems existentes en ALMACÉN"
            >
              📦 Agregar (ALMACÉN)
            </Button>
            {header && isEnUso && (
              <Link
                to={`/equipos/${header.equipo_id}/agregar-en-uso`}
                className="inline-flex items-center justify-center rounded-xl bg-[#80F9FA] text-slate-900 px-4 py-3 text-sm shadow-sm hover:bg-[#6DE2E3]"
                title="Crear y asignar nuevos ítems en USO a este equipo"
              >
                ➕ Agregar ítems (EN USO)
              </Link>
            )}
          </div>
        </div>

        {/* Tablas asignados */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ItemsAsignados
            title="Componentes"
            rows={componentes}
            onRemove={onRemoveItem}
            loading={loading}
          />
          <ItemsAsignados
            title="Periféricos"
            rows={perifericos}
            onRemove={onRemoveItem}
            loading={loading}
          />
        </div>

        {/* Panel Agregar desde ALMACÉN (modal) */}
        {openAdd && (
          <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-3">
            <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="font-semibold">Agregar ítems desde almacén</div>
                <Button variant="secondary" onClick={() => setOpenAdd(false)}>
                  <Icon name="close" /> Cerrar
                </Button>
              </div>

              <div className="p-4 space-y-4">
                {/* Tabs clase */}
                <div className="inline-flex rounded-xl overflow-hidden ring-1 ring-slate-200">
                  {(["COMPONENTE", "PERIFERICO"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        setAddClase(c);
                        setAddFilter({ tipo: "", q: "" });
                      }}
                      className={`px-4 py-2 text-sm ${
                        addClase === c
                          ? "bg-[#80F9FA] text-slate-900"
                          : "bg-white hover:bg-slate-50"
                      }`}
                    >
                      {c === "COMPONENTE" ? "Componentes" : "Periféricos"}
                    </button>
                  ))}
                </div>

                {/* Filtros */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <div className="text-sm text-slate-600 mb-1">Tipo</div>
                    <select
                      className={fieldBase}
                      value={addFilter.tipo}
                      onChange={(e) =>
                        setAddFilter((f) => ({ ...f, tipo: e.target.value }))
                      }
                    >
                      <option value="">(Todos)</option>
                      {addTypeOpts.map((t) => (
                        <option key={`${t.clase}-${t.id}`} value={t.nombre}>
                          {t.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-sm text-slate-600 mb-1">Buscar (código)</div>
                    <input
                      className={fieldBase}
                      placeholder="Ej. PC-001"
                      value={addFilter.q}
                      onChange={(e) =>
                        setAddFilter((f) => ({ ...f, q: e.target.value }))
                      }
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <Button
                      variant="secondary"
                      onClick={() => loadDisponibles(1, addPage.size)}
                      disabled={!areaId}
                    >
                      Aplicar filtros
                    </Button>
                  </div>
                </div>

                {/* Tabla disponibles */}
                <div className={section + " overflow-hidden"}>
                  <div className="overflow-auto max-h-[50vh]">
                    <table className="min-w-full table-auto">
                      <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr className="text-left text-sm text-slate-600">
                          <th className="px-3 py-2">Código</th>
                          <th className="px-3 py-2">Tipo</th>
                          <th className="px-3 py-2">Ingresó</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {addPage.items.map((r) => (
                          <tr key={r.item_id} className="border-t">
                            <td className="px-3 py-2 font-mono">{r.item_codigo}</td>
                            <td className="px-3 py-2">{r.tipo}</td>
                            <td className="px-3 py-2">
                              {r.created_at
                                ? new Date(r.created_at).toLocaleString()
                                : "-"}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <Button variant="primary" onClick={() => onAddItem(r)}>
                                Agregar
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {addPage.items.length === 0 && (
                          <tr>
                            <td className="px-3 py-6" colSpan={4}>
                              <EmptyState
                                title="No hay ítems disponibles"
                                desc="Ajusta los filtros o cambia la clase para revisar otros ítems."
                              />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginación */}
                  <div className="flex items-center justify-between p-3 border-t border-slate-200">
                    <div className={`${MUTED} text-sm`}>
                      Total: {addPage.total} · Página {addPage.page}
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className={fieldBase + " py-2 w-36"}
                        value={addPage.size}
                        onChange={async (e) => {
                          const s = Number(e.target.value);
                          await loadDisponibles(1, s);
                        }}
                      >
                        {[10, 20, 50].map((n) => (
                          <option key={n} value={n}>
                            {n} por página
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="secondary"
                        disabled={addPage.page <= 1}
                        onClick={() =>
                          loadDisponibles(addPage.page - 1, addPage.size)
                        }
                        title="Anterior"
                      >
                        <Icon name="chevL" />
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={addPage.page * addPage.size >= addPage.total}
                        onClick={() =>
                          loadDisponibles(addPage.page + 1, addPage.size)
                        }
                        title="Siguiente"
                      >
                        <Icon name="chevR" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button variant="secondary" onClick={() => setOpenAdd(false)}>
                    Cerrar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading && <div className="text-sm text-slate-500">Cargando…</div>}
      </div>
    </div>
  );
}

/* ------------------------ Auxiliar: tabla asignados ------------------------ */
function ItemsAsignados({
  title,
  rows,
  onRemove,
  loading,
}: {
  title: string;
  rows: {
    item_id: number;
    item_codigo: string;
    tipo: string;
    clase: Clase;
    estado: string;
  }[];
  onRemove: (it: {
    item_id: number;
    item_codigo: string;
    tipo: string;
    clase: Clase;
    estado: string;
  }) => void;
  loading?: boolean;
}) {
  return (
    <div className={section}>
      <div className="p-3 border-b border-slate-200">
        <div className="font-semibold">{title}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead className="bg-slate-50">
            <tr className="text-left text-sm text-slate-600">
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={`sk-${i}`} />)}
            {!loading &&
              rows.map((r) => (
                <tr key={r.item_id} className="border-t">
                  <td className="px-3 py-2 font-mono">{r.item_codigo}</td>
                  <td className="px-3 py-2">{r.tipo}</td>
                  <td className="px-3 py-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {r.estado}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 justify-end">
                      <Link
                        to={`/items/${r.item_id}`}
                        className="px-3 py-2 rounded-xl bg-[#80F9FA] text-slate-900 text-sm hover:bg-[#6DE2E3]"
                        title="Ver ficha técnica"
                      >
                        Ver ficha
                      </Link>
                      <button
                        className="inline-flex items-center justify-center rounded-xl border border-rose-300 text-rose-700 px-3 py-2 text-sm hover:bg-rose-50 transition"
                        onClick={() => onRemove(r)}
                        title="Retirar del equipo"
                      >
                        Retirar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="px-3 py-6" colSpan={4}>
                  <EmptyState
                    title="Sin registros"
                    desc="Aún no hay ítems asignados a este equipo."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
