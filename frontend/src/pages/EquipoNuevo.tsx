import { useEffect, useMemo, useState } from "react";
import http from "../api/http";
import { useNavigate, useParams } from "react-router-dom";

/* =========================
   Tipos
========================= */
type Clase = "COMPONENTE" | "PERIFERICO";
type ItemType = { id: number; clase: Clase; nombre: string };
type ItemRow = {
  item_id: number;
  item_codigo: string;
  clase: Clase;
  tipo: string;
  estado: string;
  created_at?: string | null;
};
type ItemsPage = { items: ItemRow[]; total: number; page: number; size: number };

/* =========================
   Tema Hospital – Crema + Blanco (Tailwind) con turquesa
========================= */
const BG_APP = "bg-[#FFFDF8]";
const TEXT = "text-slate-800";
const MUTED = "text-slate-600";

const section = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const card = section + " p-4 md:p-5";
const baseText = "leading-relaxed tracking-[0.01em]";

const focusRing =
  "focus:outline-none focus:ring-2 focus:ring-[#80F9FA]/40 focus:border-[#80F9FA]/60";
const fieldBase =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-base placeholder-slate-400 " +
  TEXT +
  " " +
  focusRing +
  " transition";

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base " +
  TEXT +
  " hover:bg-slate-50 active:bg-slate-100 transition disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[88px]";
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-base bg-[#80F9FA] text-slate-900 font-medium shadow-sm hover:bg-[#6DE2E3] active:bg-[#5FD0D1] transition disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[112px]";

/* Pill turquesa para contador */
const pill =
  "inline-flex items-center justify-center rounded-full bg-[#80F9FA] text-slate-900 text-sm px-3 py-1.5 shadow-sm hover:bg-[#6DE2E3]";

/* =========================
   UI helpers
========================= */
function Drawer(props: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const { open, onClose, children, title, subtitle } = props;
  return (
    <>
      <div
        className={`fixed inset-0 bg-black/30 transition-opacity ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed right-0 top-0 h-full w-full sm:w-[520px] bg-white shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-lg">{title || "Seleccionados"}</div>
                {subtitle && <div className={MUTED + " text-sm"}>{subtitle}</div>}
              </div>
              <button className={btnBase} onClick={onClose} aria-label="Cerrar">
                Cerrar
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
    </>
  );
}

/* =========================
   Página
========================= */
export default function EquipoNuevo() {
  const { areaId } = useParams();
  const aid = Number(areaId);
  const nav = useNavigate();

  const [form, setForm] = useState({
    codigo: "",
    nombre: "",
    estado: "ALMACEN",
    usuario_final: "",
    login: "",
    password: "",
  });

  // tipos para filtros
  const [typesC, setTypesC] = useState<ItemType[]>([]);
  const [typesP, setTypesP] = useState<ItemType[]>([]);

  // filtros + paginación servidor
  const [filtC, setFiltC] = useState<{ tipo: string; q: string }>({ tipo: "", q: "" });
  const [filtP, setFiltP] = useState<{ tipo: string; q: string }>({ tipo: "", q: "" });
  const [pageC, setPageC] = useState<ItemsPage>({ items: [], total: 0, page: 1, size: 10 });
  const [pageP, setPageP] = useState<ItemsPage>({ items: [], total: 0, page: 1, size: 10 });

  // selección
  const [selComp, setSelComp] = useState<ItemRow[]>([]);
  const [selPeri, setSelPeri] = useState<ItemRow[]>([]);

  // drawer de seleccionados
  const [openDrawer, setOpenDrawer] = useState(false);
  const [spage, setSpage] = useState(1);
  const [ssize, setSsize] = useState(10);

  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function loadTypes() {
    const [c, p] = await Promise.all([
      http.get<ItemType[]>("/api/item-types?clase=COMPONENTE"),
      http.get<ItemType[]>("/api/item-types?clase=PERIFERICO"),
    ]);
    setTypesC(c.data || []);
    setTypesP(p.data || []);
  }

  async function loadDisponibles(clase: Clase, page = 1, size = 10) {
    const f = clase === "COMPONENTE" ? filtC : filtP;
    const params: any = { clase, page, size };
    if (f.tipo) params.tipo = f.tipo;
    if (f.q) params.q = f.q;
    const r = await http.get<ItemsPage>(`/api/areas/${aid}/items-disponibles`, { params });
    if (clase === "COMPONENTE") setPageC(r.data);
    else setPageP(r.data);
  }

  // Sugerir código por área al montar / cambiar área
  useEffect(() => {
    (async () => {
      try {
        const r = await http.get<{ next_code: string }>(`/api/areas/${aid}/equipos/next-code`, {
          params: { prefix: "PC-", pad: 3 },
        });
        if (r.data?.next_code && !form.codigo) {
          setForm((f) => ({ ...f, codigo: r.data.next_code }));
        }
      } catch {
        // opcional
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aid]);

  useEffect(() => {
    loadTypes();
    loadDisponibles("COMPONENTE", 1, pageC.size);
    loadDisponibles("PERIFERICO", 1, pageP.size);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aid]);

  const compLeft = useMemo(
    () => pageC.items.filter((i) => !selComp.some((s) => s.item_id === i.item_id)),
    [pageC.items, selComp]
  );
  const periLeft = useMemo(
    () => pageP.items.filter((i) => !selPeri.some((s) => s.item_id === i.item_id)),
    [pageP.items, selPeri]
  );

  const totalSelected = selComp.length + selPeri.length;

  async function crearEquipo() {
    setMsg(null);
    setOk(null);
    if (!form.codigo.trim() || !form.nombre.trim()) {
      setMsg("Código y nombre son requeridos");
      return;
    }
    const items = [
      ...selComp.map((r) => ({ item_id: r.item_id, slot: null })),
      ...selPeri.map((r) => ({ item_id: r.item_id, slot: null })),
    ];

    async function postOnce(payload: typeof form) {
      return http.post<{ equipo_id: number }>(`/api/areas/${aid}/equipos`, {
        ...payload,
        items,
      });
    }

    try {
      const r = await postOnce(form);
      setOk("Equipo creado");
      nav(`/equipos/${r.data.equipo_id}`);
    } catch (e: any) {
      const txt = e?.response?.data?.error || "";
      const isDup = /duplicad.|llave duplicada|duplicate/i.test(txt);
      if (isDup) {
        try {
          const sug = await http.get<{ next_code: string }>(`/api/areas/${aid}/equipos/next-code`, {
            params: { prefix: "PC-", pad: 3 },
          });
          const next_code = sug.data?.next_code;
          if (next_code) {
            const r2 = await postOnce({ ...form, codigo: next_code });
            setOk("Equipo creado");
            nav(`/equipos/${r2.data.equipo_id}`);
            return;
          }
        } catch {
          // ignore
        }
      }
      setMsg(txt || "No se pudo crear");
    }
  }

  /* =========================
     Render
  ========================= */
  return (
    <div className={`${BG_APP} ${TEXT} min-h-[calc(100vh-64px)]`}>
      <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 py-5 space-y-5">
        {/* Header */}
        <div className={`${section} px-4 py-4 md:px-6 md:py-5 ${baseText}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-[22px] md:text-[26px] font-semibold">
                Nuevo equipo <span className="text-[#80F9FA]">•</span>{" "}
                <span className="font-normal text-slate-500">desde Almacén</span>
              </h1>
              <div className={MUTED + " text-sm"}>Área ID {aid}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-700 text-sm">Seleccionados</span>
              <button className={pill} onClick={() => setOpenDrawer(true)} title="Ver seleccionados">
                {totalSelected}
              </button>
            </div>
          </div>
        </div>

        {/* Mensajes */}
        {msg && <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800">{msg}</div>}
        {ok && <div className="p-3 rounded-xl border border-emerald-200 bg-[#E6FFFE] text-slate-900">{ok}</div>}

        {/* Meta equipo */}
        <div className={card + " " + baseText}>
          <div className="text-base font-medium mb-3">Datos del equipo</div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block">
              <div className={MUTED + " text-sm"}>Código</div>
              <input
                className={fieldBase + " mt-1"}
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                placeholder="Ej. PC-001"
              />
            </label>
            <label className="block">
              <div className={MUTED + " text-sm"}>Nombre</div>
              <input
                className={fieldBase + " mt-1"}
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Nombre visible"
              />
            </label>
            <label className="block">
              <div className={MUTED + " text-sm"}>Estado</div>
              <select
                className={fieldBase + " mt-1"}
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
              >
                <option value="ALMACEN">ALMACEN</option>
                <option value="USO">USO</option>
                <option value="MANTENIMIENTO">MANTENIMIENTO</option>
                <option value="BAJA">BAJA</option>
              </select>
            </label>

            <label className="block">
              <div className={MUTED + " text-sm"}>Usuario final</div>
              <input
                className={fieldBase + " mt-1"}
                value={form.usuario_final}
                onChange={(e) => setForm({ ...form, usuario_final: e.target.value })}
                placeholder="Ej. Juan Pérez"
              />
            </label>
            <label className="block">
              <div className={MUTED + " text-sm"}>Login</div>
              <input
                className={fieldBase + " mt-1"}
                value={form.login}
                onChange={(e) => setForm({ ...form, login: e.target.value })}
                placeholder="cuenta/red"
              />
            </label>
            <label className="block">
              <div className={MUTED + " text-sm"}>Password</div>
              <input
                className={fieldBase + " mt-1"}
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
              />
            </label>
          </div>
        </div>

        {/* Lista de Componentes */}
        <SelectorLista
          title="Componentes disponibles"
          page={pageC}
          types={typesC}
          filter={filtC}
          onFilter={setFiltC}
          rows={compLeft}
          onApply={(p, s) => loadDisponibles("COMPONENTE", p, s)}
          onAdd={(row) => setSelComp((v) => [...v, row])}
        />

        {/* Lista de Periféricos */}
        <SelectorLista
          title="Periféricos disponibles"
          page={pageP}
          types={typesP}
          filter={filtP}
          onFilter={setFiltP}
          rows={periLeft}
          onApply={(p, s) => loadDisponibles("PERIFERICO", p, s)}
          onAdd={(row) => setSelPeri((v) => [...v, row])}
        />

        <div className="flex justify-end">
          <button
            className={btnPrimary}
            onClick={crearEquipo}
            disabled={totalSelected === 0 || !form.codigo.trim() || !form.nombre.trim()}
            title={totalSelected === 0 ? "Agrega al menos 1 ítem" : "Crear equipo"}
          >
            Crear equipo
          </button>
        </div>

        {/* Drawer de seleccionados */}
        <Drawer
          open={openDrawer}
          onClose={() => setOpenDrawer(false)}
          title="Ítems seleccionados"
          subtitle={`${totalSelected} seleccionado${totalSelected === 1 ? "" : "s"}`}
        >
          <div className="p-4 space-y-3">
            <SelectedTable
              data={[...selComp, ...selPeri]}
              page={spage}
              size={ssize}
              onPage={setSpage}
              onSize={setSsize}
              onRemove={(r) => {
                if (r.clase === "COMPONENTE")
                  setSelComp((v) => v.filter((x) => x.item_id !== r.item_id));
                else setSelPeri((v) => v.filter((x) => x.item_id !== r.item_id));
              }}
            />
          </div>
        </Drawer>
      </div>
    </div>
  );
}

/* =========================
   SelectorLista
========================= */
function SelectorLista(props: {
  title: string;
  page: ItemsPage;
  types: ItemType[];
  filter: { tipo: string; q: string };
  onFilter: (f: { tipo: string; q: string }) => void;
  rows: ItemRow[];
  onApply: (p: number, s: number) => void;
  onAdd: (row: ItemRow) => void;
}) {
  const { title, page, types, filter, onFilter, rows, onApply, onAdd } = props;
  const totalPages = Math.max(1, Math.ceil(page.total / page.size));

  return (
    <div className={card + " " + baseText}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-base font-medium">{title}</div>
        <div className={MUTED + " text-sm"}>
          Página {page.page} / {totalPages} · {page.total} ítems
        </div>
      </div>

      {/* Filtros */}
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <label className="block">
          <div className={MUTED + " text-sm"}>Tipo</div>
          <select
            className={fieldBase + " mt-1"}
            value={filter.tipo}
            onChange={(e) => onFilter({ ...filter, tipo: e.target.value })}
          >
            <option value="">(Todos)</option>
            {types.map((t) => (
              <option key={t.id} value={t.nombre}>
                {t.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className={MUTED + " text-sm"}>Buscar por código</div>
          <input
            className={fieldBase + " mt-1"}
            value={filter.q}
            onChange={(e) => onFilter({ ...filter, q: e.target.value })}
            placeholder="Ej. ITM-0001"
          />
        </label>

        <div className="flex items-end gap-2">
          <button className={btnBase + " w-full md:w-auto"} onClick={() => onApply(1, page.size)}>
            Aplicar
          </button>
          <button
            className={btnBase + " w-full md:w-auto"}
            onClick={() => {
              onFilter({ tipo: "", q: "" });
              onApply(1, page.size);
            }}
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto mt-4">
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
            {rows.map((r) => (
              <tr key={r.item_id} className="border-t">
                <td className="px-3 py-2">{r.item_codigo}</td>
                <td className="px-3 py-2">{r.tipo}</td>
                <td className="px-3 py-2">{r.estado}</td>
                <td className="px-3 py-2 text-right">
                  <button className={btnPrimary} onClick={() => onAdd(r)}>
                    Agregar
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-slate-500" colSpan={4}>
                  Sin registros
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          className={btnBase}
          disabled={page.page <= 1}
          onClick={() => onApply(page.page - 1, page.size)}
        >
          ◀
        </button>
        <select
          className={fieldBase + " w-28"}
          value={page.size}
          onChange={(e) => onApply(1, Number(e.target.value))}
          aria-label="Tamaño de página"
        >
          {[10, 20, 50].map((s) => (
            <option key={s} value={s}>
              {s} / pág
            </option>
          ))}
        </select>
        <button
          className={btnBase}
          disabled={page.page >= totalPages}
          onClick={() => onApply(page.page + 1, page.size)}
        >
          ▶
        </button>
      </div>
    </div>
  );
}

/* =========================
   Tabla de seleccionados (en Drawer)
========================= */
function SelectedTable({
  data,
  page,
  size,
  onPage,
  onSize,
  onRemove,
}: {
  data: ItemRow[];
  page: number;
  size: number;
  onPage: (p: number) => void;
  onSize: (s: number) => void;
  onRemove: (r: ItemRow) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(data.length / size));
  const slice = data.slice((page - 1) * size, page * size);

  return (
    <div className={section}>
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className={MUTED + " text-sm"}>
          Página {Math.min(page, totalPages)} / {totalPages} · {data.length} ítems
        </div>
        <div className="flex items-center gap-2">
          <button className={btnBase} disabled={page <= 1} onClick={() => onPage(page - 1)}>
            ◀
          </button>
          <select
            className={fieldBase + " w-28"}
            value={size}
            onChange={(e) => {
              onSize(Number(e.target.value));
              onPage(1);
            }}
          >
            {[5, 10, 20, 50].map((s) => (
              <option key={s} value={s}>
                {s} / pág
              </option>
            ))}
          </select>
          <button
            className={btnBase}
            disabled={page >= totalPages}
            onClick={() => onPage(page + 1)}
          >
            ▶
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead className="bg-slate-50">
            <tr className="text-left text-sm text-slate-600">
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Clase</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => (
              <tr key={r.item_id} className="border-t">
                <td className="px-3 py-2">{r.item_codigo}</td>
                <td className="px-3 py-2">{r.clase}</td>
                <td className="px-3 py-2">{r.tipo}</td>
                <td className="px-3 py-2 text-right">
                  <button className={btnBase} onClick={() => onRemove(r)}>
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-slate-500" colSpan={4}>
                  Sin seleccionados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
