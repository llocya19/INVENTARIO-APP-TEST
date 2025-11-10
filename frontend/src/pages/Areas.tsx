// src/pages/Areas.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import http from "../api/http";
import { getUser } from "../services/authService";

// === UI reutilizable ===
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import InlineAlert from "@/components/ui/InlineAlert";

/* =========================
   Tipos
========================= */
type Area = { id: number; nombre: string; padre_id: number | null };
type AreaInfo = {
  area: { id:number; nombre:string; padre_id:number|null };
  ancestors: { id:number; nombre:string; padre_id:number|null }[];
  children: { id:number; nombre:string }[];
};

/* =========================
   Tema Hospital – Crema + Blanco (Tailwind)
========================= */
const BG_APP   = "bg-[#FFFDF8]"; // crema institucional
const TEXT     = "text-slate-800";
const MUTED    = "text-slate-600";

// Contenedores
const section  = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const cardBase = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

// Tipografía/espaciado base
const baseText = "leading-relaxed tracking-[0.01em]";

// Controles (accesibles)
const focusRing =
  "focus:outline-none focus:ring-2 focus:ring-emerald-300/40 focus:border-emerald-300/60";
const fieldBase =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-base " +
  "placeholder-slate-400 " + TEXT + " " + focusRing + " transition";

// Badges jerarquía
function Badge({ kind }: { kind: "root" | "child" }) {
  return (
    <span
      className={
        "text-xs px-2 py-0.5 rounded-full ring-1 " +
        (kind === "root"
          ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
          : "bg-sky-50 text-sky-700 ring-sky-100")
      }
    >
      {kind === "root" ? "Raíz" : "Subárea"}
    </span>
  );
}

// Skeleton
function SkeletonCard() {
  return (
    <div className={cardBase + " animate-pulse"}>
      <div className="h-5 w-2/3 bg-slate-200 rounded mb-2" />
      <div className="h-4 w-28 bg-slate-200 rounded mb-4" />
      <div className="flex gap-2">
        <div className="h-10 w-24 bg-slate-200 rounded" />
        <div className="h-10 w-24 bg-slate-200 rounded" />
      </div>
    </div>
  );
}

/* =========================
   Página
========================= */
export default function Areas() {
  const u = getUser();
  const isAdmin = u?.rol === "ADMIN";

  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [msg, setMsg] = useState<string|null>(null);
  const [ok, setOk]   = useState<string|null>(null);

  // forms
  const [rootForm, setRootForm] = useState({ nombre: "" });

  // subárea
  const [subForm,  setSubForm]  = useState({ nombre: "", padre_id: "" });
  const [subRootId, setSubRootId] = useState<string>("");

  // UI
  const [q, setQ] = useState<string>("");
  const [showForms, setShowForms] = useState<boolean>(true);
  const [onlyRoots, setOnlyRoots] = useState<boolean>(false);

  // modal info
  const [showInfo, setShowInfo] = useState(false);
  const [info, setInfo] = useState<AreaInfo | null>(null);

  // paginación principal
  const [page, setPage] = useState<number>(1);
  const [size, setSize] = useState<number>(9);

  // paginación subáreas (modal)
  const [subPage, setSubPage] = useState<number>(1);
  const [subSize, setSubSize] = useState<number>(8);

  async function load() {
    setMsg(null); setLoading(true);
    try {
      const r = await http.get<Area[]>("/api/areas");
      setAreas(r.data || []);
    } catch (e:any) {
      setMsg(e?.response?.data?.error || "No se pudo cargar las áreas");
    } finally {
      setLoading(false);
    }
  }
  useEffect(()=>{ load(); }, []);

  // === Helpers jerarquía (cliente) ===
  const byParent = useMemo(() => {
    const map = new Map<number|null, Area[]>();
    for (const a of areas) {
      const key = a.padre_id as number | null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    for (const arr of map.values()) arr.sort((x,y)=> x.nombre.localeCompare(y.nombre));
    return map;
  }, [areas]);

  const roots = useMemo(() => (byParent.get(null) || []), [byParent]);

  function getDescendantsFlatten(rootId: number) {
    const result: {id:number; nombre:string; depth:number}[] = [];
    function walk(id:number, depth:number) {
      const self = areas.find(a=>a.id===id);
      if (self) result.push({ id:self.id, nombre:self.nombre, depth });
      const children = byParent.get(id) || [];
      for (const c of children) walk(c.id, depth+1);
    }
    walk(rootId, 0);
    return result;
  }

  // crear raíz
  async function createRoot(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null); setOk(null);
    const nombre = rootForm.nombre.trim();
    if (!nombre) { setMsg("El nombre del área es obligatorio."); return; }
    try{
      await http.post("/api/areas/root", { nombre });
      setOk(`Área raíz “${nombre}” creada correctamente.`);
      setRootForm({ nombre: "" });
      setPage(1);
      load();
    }catch(e:any){
      setMsg(e?.response?.data?.error || "No se pudo crear el área raíz.");
    }
  }

  // crear subárea
  async function createSub(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null); setOk(null);
    const nombre = subForm.nombre.trim();
    const padre_id = Number(subForm.padre_id);
    if (!subRootId) { setMsg("Primero elige el área raíz."); return; }
    if (!nombre || !padre_id) {
      setMsg("Completa el nombre y el padre de la subárea."); return;
    }
    try{
      await http.post("/api/areas/sub", { nombre, padre_id });
      setOk(`Subárea “${nombre}” creada correctamente.`);
      setSubForm({ nombre: "", padre_id: "" });
      setPage(1);
      load();
    }catch(e:any){
      setMsg(e?.response?.data?.error || "No se pudo crear la subárea.");
    }
  }

  async function openInfo(id:number) {
    setMsg(null); setInfo(null); setShowInfo(true);
    setSubPage(1);
    try{
      const r = await http.get<AreaInfo>(`/api/areas/${id}/info`);
      setInfo(r.data);
    }catch(e:any){
      setMsg(e?.response?.data?.error || "No se pudo obtener la información del área.");
    }
  }

  // filtro + paginación
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let base = areas;
    if (term) base = base.filter(a => a.nombre.toLowerCase().includes(term) || String(a.id).includes(term));
    if (onlyRoots) base = base.filter(a => a.padre_id === null);
    return base;
  }, [areas, q, onlyRoots]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filtered.length / size)),
    [filtered.length, size]
  );

  const pageItems = useMemo(() => {
    const start = (page - 1) * size;
    return filtered.slice(start, start + size);
  }, [filtered, page, size]);

  // paginación subáreas en modal
  const subTotalPages = useMemo(() => {
    const total = info?.children?.length || 0;
    return Math.max(1, Math.ceil(total / subSize));
  }, [info?.children, subSize]);

  const subPageItems = useMemo(() => {
    const all = info?.children || [];
    const start = (subPage - 1) * subSize;
    return all.slice(start, start + subSize);
  }, [info?.children, subPage, subSize]);

  useEffect(() => { setPage(1); }, [q, size, onlyRoots]);

  // coherencia raíz ↔ padre
  useEffect(() => {
    if (!subRootId) return;
    const rid = Number(subRootId);
    const allowed = new Set(getDescendantsFlatten(rid).map(d => d.id));
    if (subForm.padre_id && !allowed.has(Number(subForm.padre_id))) {
      setSubForm(s => ({ ...s, padre_id: "" }));
    }
  }, [subRootId, areas]); // si cambian áreas, recalcular

  useEffect(() => {
    if (!subForm.padre_id) return;
    const pid = Number(subForm.padre_id);
    let cur = areas.find(a=>a.id===pid) || null;
    while (cur && cur.padre_id !== null) cur = areas.find(a=>a.id===cur!.padre_id) || null;
    if (cur && String(cur.id) !== subRootId) setSubRootId(String(cur.id));
  }, [subForm.padre_id, areas]);

  const padreOptions = useMemo(() => {
    if (!subRootId) return [] as {id:number; nombre:string; depth:number}[];
    return getDescendantsFlatten(Number(subRootId));
  }, [subRootId, areas]);

  return (
    <div className={`${BG_APP} ${TEXT} min-h-[calc(100vh-64px)]`}>
      <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 py-5 space-y-5">
        {/* Header */}
        <div className={`${section} px-4 py-4 md:px-6 md:py-5`}>
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div className="space-y-1">
              <h1 className={"text-[22px] md:text-[26px] font-semibold " + baseText}>
                Áreas del Hospital <span className="text-emerald-600">•</span>{" "}
                <span className="font-normal text-slate-500">Soporte TI</span>
              </h1>
              <div className={`${MUTED} text-sm`}>
                {filtered.length} {filtered.length === 1 ? "área" : "áreas"} · página {page} de {totalPages}
              </div>
            </div>

            {/* Búsqueda + filtro */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
              <div className="flex gap-2">
                <input
                  className={fieldBase + " w-full"}
                  placeholder="Buscar servicio, ambiente o ID…"
                  value={q}
                  onChange={(e)=>setQ(e.target.value)}
                  aria-label="Buscar áreas"
                />
                <Button
                  variant="outline"
                  onClick={()=>setQ("")}
                  disabled={!q}
                  aria-label="Limpiar búsqueda"
                >
                  Limpiar
                </Button>
              </div>
              <Button
                variant={onlyRoots ? "soft-emerald" : "outline"}
                onClick={()=>setOnlyRoots(v=>!v)}
                title="Mostrar solo áreas raíz"
                aria-pressed={onlyRoots}
              >
                Solo raíces
              </Button>
            </div>
          </div>
        </div>

        {/* Mensajes */}
        {msg && (
          <InlineAlert kind="error">
            {msg}
          </InlineAlert>
        )}
        {ok && (
          <InlineAlert kind="success">
            {ok}
          </InlineAlert>
        )}

        {/* ADMIN: acordeón */}
        {isAdmin && (
          <div className={section}>
            <button
              className="w-full flex items-center justify-between px-4 py-3 md:px-5"
              onClick={()=>setShowForms(s => !s)}
              aria-expanded={showForms}
            >
              <span className="font-medium">Crear áreas</span>
              <span className={MUTED + " text-sm"}>{showForms ? "Ocultar" : "Mostrar"}</span>
            </button>

            {showForms && (
              <div className="border-t border-slate-200 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 md:p-5">
                {/* raíz */}
                <Card title="Área raíz (Servicio)">
                  <label className="block text-sm text-slate-600">
                    Nombre del servicio
                    <input
                      className={fieldBase + " mt-1"}
                      placeholder='Ej. "Emergencia", "UCI", "Farmacia"'
                      value={rootForm.nombre}
                      onChange={e=>setRootForm({ nombre: e.target.value })}
                    />
                  </label>
                  <p className="text-[12px] text-slate-500 mt-1">
                    Usa el nombre oficial del servicio.
                  </p>
                  <div className="mt-3">
                    <form onSubmit={createRoot}>
                      <Button type="submit" variant="primary">
                        Crear servicio
                      </Button>
                    </form>
                  </div>
                </Card>

                {/* subárea */}
                <Card title="Subárea (Ambiente/Unidad)">
                  <form onSubmit={createSub}>
                    <label className="block text-sm text-slate-600">
                      Servicio raíz
                      <select
                        className={fieldBase + " mt-1"}
                        value={subRootId}
                        onChange={(e)=> setSubRootId(e.target.value)}
                      >
                        <option value="">Seleccione…</option>
                        {roots.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.nombre} (ID {r.id})
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      <label className="block text-sm text-slate-600">
                        Nombre de la subárea
                        <input
                          className={fieldBase + " mt-1"}
                          placeholder='Ej. "Sala de Procedimientos", "Hospitalización A"'
                          value={subForm.nombre}
                          onChange={e=>setSubForm({ ...subForm, nombre: e.target.value })}
                        />
                      </label>

                      <label className="block text-sm text-slate-600">
                        Padre dentro del servicio
                        <select
                          className={fieldBase + " mt-1"}
                          value={subForm.padre_id}
                          onChange={e=>setSubForm({ ...subForm, padre_id: e.target.value })}
                          disabled={!subRootId}
                        >
                          <option value="">{subRootId ? "Seleccione…" : "Elige un servicio primero"}</option>
                          {padreOptions.map(opt => (
                            <option key={opt.id} value={opt.id}>
                              {`${"— ".repeat(opt.depth)}${opt.nombre}`} {opt.depth===0 ? "(servicio)" : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {/* Vista árbol */}
                    {subRootId && (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                        <div className="text-sm text-slate-600 mb-2">Estructura del servicio</div>
                        <ul className="space-y-1 text-[15px] text-slate-800 max-h-44 overflow-auto">
                          {padreOptions.map(opt => (
                            <li key={`tree-${opt.id}`}>
                              <span className={opt.depth===0 ? "font-medium text-emerald-700" : ""}>
                                {`${"— ".repeat(opt.depth)}${opt.nombre}`}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-3">
                      <Button
                        type="submit"
                        variant="accent"
                        disabled={!subForm.nombre.trim() || !subForm.padre_id}
                      >
                        Crear subárea
                      </Button>
                    </div>
                  </form>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Grid de áreas */}
        <div className="space-y-4">
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
            {loading && Array.from({ length: 8 }).map((_,i)=> <SkeletonCard key={i} />)}

            {!loading && pageItems.map(a => (
              <Card key={a.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-lg font-semibold flex items-center gap-2 whitespace-normal break-words">
                      <span className="whitespace-normal break-words">
                        {a.nombre}
                      </span>
                      <Badge kind={a.padre_id ? "child" : "root"} />
                    </div>
                    <div className="text-sm text-slate-500 mt-1">ID {a.id}</div>
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button
                      variant="outline"
                      onClick={()=>openInfo(a.id)}
                      title="Ver información del área"
                    >
                      Info
                    </Button>
                    <Link to={`/areas/${a.id}`} title="Abrir área">
                      <Button variant="primary">Abrir</Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}

            {!loading && filtered.length===0 && (
              <div className={section + " p-10 col-span-full text-center"}>
                <div className="text-slate-700 text-base md:text-lg">No hay áreas que coincidan</div>
                {q && <div className="text-sm text-slate-500 mt-1">Prueba limpiar la búsqueda o revisa la ortografía.</div>}
              </div>
            )}
          </div>

          {/* Paginación (con botones reutilizables) */}
          {!loading && filtered.length > 0 && (
            <div className={`${section} p-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center ${baseText}`}>
              <div className="text-slate-600">
                Mostrando {(page - 1) * size + 1}–{Math.min(page * size, filtered.length)} de {filtered.length}
              </div>
              <div className="flex flex-wrap gap-2 items-center justify-start sm:justify-end">
                <Button
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  ◀ Anterior
                </Button>
                <span className="text-slate-700 px-2">Página {page} / {totalPages}</span>
                <Button
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  Siguiente ▶
                </Button>
                <select
                  className={fieldBase + " w-28"}
                  value={size}
                  onChange={(e) => { setSize(Number(e.target.value)); setPage(1); }}
                  aria-label="Tamaño de página"
                >
                  {[8, 12, 16, 20].map(n => <option key={n} value={n}>{n} / pág</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Modal Info (mantiene tu lógica, luego lo pasamos a ui/Modal) */}
        {showInfo && (
          <div className="fixed inset-0 bg-black/10 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
            <div className={section + " w-full max-w-[760px]"}>
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="font-semibold text-base md:text-lg">Información del área</div>
                <Button variant="outline" onClick={()=>setShowInfo(false)}>Cerrar</Button>
              </div>

              <div className="p-4 space-y-4">
                {!info ? (
                  <div className="text-slate-600">Cargando…</div>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Card title="Área">
                        <div className="mt-1 font-medium flex items-center gap-2 whitespace-normal break-words">
                          <span className="whitespace-normal break-words">{info.area.nombre}</span>
                          <span className="text-xs text-slate-500">ID {info.area.id}</span>
                          <Badge kind={info.area.padre_id ? "child" : "root"} />
                        </div>
                      </Card>

                      <Card title="Jerarquía (ancestros)">
                        {info.ancestors.length === 0 ? (
                          <div className="text-slate-700 mt-1">— Es servicio raíz —</div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {info.ancestors.map((p, i) => (
                              <span key={p.id} className="inline-flex items-center gap-1">
                                <span className="px-2 py-0.5 rounded-full bg-slate-50 text-slate-800 text-xs border border-slate-200">
                                  {p.nombre}
                                </span>
                                {i < info.ancestors.length - 1 && <span className="text-slate-400">›</span>}
                              </span>
                            ))}
                          </div>
                        )}
                      </Card>
                    </div>

                    <Card title="Subáreas directas">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                        <div className="text-sm text-slate-600">Listado</div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            disabled={subPage <= 1}
                            onClick={() => setSubPage(p => Math.max(1, p - 1))}
                            aria-label="Página anterior"
                          >
                            ◀
                          </Button>
                          <span className="text-sm text-slate-600">
                            Página {subPage} / {subTotalPages}
                          </span>
                          <Button
                            variant="outline"
                            disabled={subPage >= subTotalPages}
                            onClick={() => setSubPage(p => Math.min(subTotalPages, p + 1))}
                            aria-label="Página siguiente"
                          >
                            ▶
                          </Button>
                          <select
                            className={fieldBase + " w-24"}
                            value={subSize}
                            onChange={(e) => { setSubSize(Number(e.target.value)); setSubPage(1); }}
                            aria-label="Tamaño de página de subáreas"
                          >
                            {[4, 8, 12, 16].map(n => <option key={n} value={n}>{n} / pág</option>)}
                          </select>
                        </div>
                      </div>

                      {info.children.length === 0 ? (
                        <div className="text-slate-700">— Sin subáreas —</div>
                      ) : (
                        <ul className="grid sm:grid-cols-2 gap-2">
                          {subPageItems.map(c => (
                            <li
                              key={c.id}
                              className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                            >
                              <div className="whitespace-normal break-words">{c.nombre}</div>
                              <span className="text-xs text-slate-500 shrink-0">ID {c.id}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Card>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
