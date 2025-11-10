// src/pages/EquipoNuevoUso.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import http from "../api/http";

/* =========================
   Tipos
========================= */
type Clase = "COMPONENTE" | "PERIFERICO";
type ItemType = { id: number; clase: Clase; nombre: string };
type Attr = { nombre: string; data_type: "text" | "int" | "numeric" | "bool" | "date"; orden?: number | null };
type SpecKV = { k: string; v: string };

type TempItem = {
  clase: Clase;
  tipo_nombre: string;
  codigo: string;
  schema: Attr[];
  specs: SpecKV[];
  files?: FileList | null;
  captured?: File[];
};

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
  items?: { item_id: number; item_codigo: string; clase: Clase; tipo: string; estado: string }[];
};

type AreaLite = { id: number; nombre: string };

type AreaItemRow = {
  item_id: number;
  item_codigo: string;
  clase: Clase;
  tipo: string;
  estado: string;
  equipo?: { equipo_id: number; equipo_codigo: string; equipo_nombre: string } | null;
};

/* =========================
   Estilos (tema hospital + turquesa)
========================= */
const BRAND = "#80F9FA";
const BG_APP = "bg-[#FFFDF8]";
const textMuted = "text-slate-600";
const card = "bg-white rounded-3xl shadow-sm ring-1 ring-slate-200";
const fieldBase =
  `w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-[15px] placeholder-slate-400
   focus:outline-none focus:ring-2 focus:ring-[${BRAND}]/50 focus:border-[${BRAND}] transition`;
const fieldReadOnly = fieldBase + " bg-slate-50 text-slate-700";
const selectBase = fieldBase + " pr-8";
const btnBase =
  `inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm
   hover:border-[${BRAND}] hover:bg-[#F0FEFE] active:bg-[#E1FDFD] transition`;
const btnPrimary =
  `inline-flex items-center justify-center rounded-xl bg-[${BRAND}] text-slate-800 px-5 py-3 text-sm shadow-sm
   hover:bg-[#6ee7e9] active:bg-[#4fd4d7] transition disabled:opacity-50 disabled:cursor-not-allowed`;

/* ============ UI: Sheet (drawer/modal) ============ */
function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <>
      <div
        className={`fixed inset-0 bg-black/30 transition-opacity ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      <div
        className={`
          fixed z-50 bg-white shadow-xl transition-transform duration-300
          right-0 top-0 h-full w-full sm:w-[960px]
          ${open ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-x-full"}
          rounded-t-3xl sm:rounded-none
        `}
        role="dialog"
        aria-modal="true"
      >
        <div className="h-full flex flex-col">
          <div className="px-4 sm:px-5 py-3 border-b flex items-center justify-between sticky top-0 bg-white z-10">
            <div className="font-semibold">{title}</div>
            <button className={btnBase} onClick={onClose}>Cerrar</button>
          </div>
          <div className="flex-1 overflow-y-auto">{children}</div>
          {footer && <div className="px-4 sm:px-5 py-3 border-t bg-slate-50">{footer}</div>}
        </div>
      </div>
    </>
  );
}

/* =========================
   Página
========================= */
export default function EquipoNuevoUso() {
  // 1) /areas/:areaId/equipos/nuevo-uso
  // 2) /equipos/:equipoId/agregar-en-uso
  const { areaId, equipoId } = useParams();
  const aidParam = Number(areaId);
  const eidParam = Number(equipoId);
  const isAppend = Number.isFinite(eidParam) && eidParam > 0;

  const nav = useNavigate();

  /* --- Paso 1: Datos del equipo --- */
  const [form, setForm] = useState({
    codigo: "",
    nombre: "",
    estado: "USO",
    usuario_final: "",
    login: "",
    password: "",
  });

  const [currentAreaId, setCurrentAreaId] = useState<number>(aidParam || 0);
  const [equipoHeader, setEquipoHeader] = useState<EquipoHeaderAPI | null>(null);

  /* Catálogos */
  const [typesC, setTypesC] = useState<ItemType[]>([]);
  const [typesP, setTypesP] = useState<ItemType[]>([]);

  /* --- Paso 2: Ítems temporales nuevos --- */
  const [temp, setTemp] = useState<TempItem[]>([]);
  const [tPage, setTPage] = useState(1);
  const [tSize, setTSize] = useState(5);

  /* --- Paso 2: Préstamos seleccionados --- */
  const [prestamos, setPrestamos] = useState<
    { item_id: number; item_codigo: string; clase: Clase; tipo: string; area_origen: number }[]
  >([]);

  /* Sheet crear/editar ítem */
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TempItem | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Cámara embebida para el draft
  const [showCam, setShowCam] = useState(false);

  /* Estado general */
  const [step, setStep] = useState<1 | 2 | 3>(isAppend ? 2 : 1);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // registrar movimientos como PRÉSTAMO para los ítems NUEVOS (opcional)
  const [registrarPrestamoNuevos, setRegistrarPrestamoNuevos] = useState<boolean>(false);

  /* =========================
     Cargas iniciales
  ========================= */
  useEffect(() => {
    (async () => {
      const [c, p] = await Promise.all([
        http.get<ItemType[]>("/api/item-types?clase=COMPONENTE"),
        http.get<ItemType[]>("/api/item-types?clase=PERIFERICO"),
      ]);
      setTypesC(c.data || []);
      setTypesP(p.data || []);
    })();
  }, []);

  // Carga del equipo si estamos en append
  useEffect(() => {
    if (!isAppend) return;
    (async () => {
      try {
        const r = await http.get<EquipoHeaderAPI>(`/api/equipos/${eidParam}`);
        const h = r.data;
        setEquipoHeader(h);
        setCurrentAreaId(h.area_id);
        setForm({
          codigo: h.equipo_codigo || "",
          nombre: h.equipo_nombre || "",
          estado: (h.estado || "USO").toUpperCase(),
          usuario_final: h.usuario_final || "",
          login: h.login || "",
          password: h.password || "",
        });
        setStep(2);
      } catch (e: any) {
        setMsg(e?.response?.data?.error || "No se pudo cargar el equipo");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAppend, eidParam]);

  // Sugerir código por área (solo en modo crear)
  useEffect(() => {
    if (isAppend || !currentAreaId) return;
    (async () => {
      try {
        const r = await http.get<{ next_code: string }>(
          `/api/areas/${currentAreaId}/equipos/next-code`,
          { params: { prefix: "PC-", pad: 3 } }
        );
        if (r.data?.next_code && !form.codigo) {
          setForm((f) => ({ ...f, codigo: r.data.next_code }));
        }
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAppend, currentAreaId]);

  /* =========================
     Helpers de ficha/tipos
  ========================= */
  async function loadSchema(clase: Clase, tipo: string) {
    if (!tipo) return [];
    const r = await http.get<Attr[]>("/api/spec/attrs", { params: { clase, tipo } });
    return r.data || [];
  }
  async function suggestCode(clase: Clase, tipo: string) {
    try {
      const r = await http.get<{ next_code: string }>("/api/items/next-code", {
        params: { clase, tipo, area_id: currentAreaId },
      });
      return r.data?.next_code || "";
    } catch {
      return "";
    }
  }
  function validateSpecs(specs: SpecKV[], schema: Attr[]) {
    const out: Record<string, any> = {};
    for (const { k, v } of specs) {
      const dt = schema.find((s) => s.nombre.toLowerCase() === k.toLowerCase())?.data_type || "text";
      if (dt === "int") {
        const n = parseInt((v ?? "").toString().replace(/[^\d-]/g, ""), 10);
        if (Number.isNaN(n)) return `El campo ${k} debe ser entero`;
        out[k] = n;
      } else if (dt === "numeric") {
        const x = parseFloat((v ?? "").toString().replace(",", ".").replace(/[^0-9.\-]/g, ""));
        if (Number.isNaN(x)) return `El campo ${k} debe ser decimal`;
        out[k] = x;
      } else if (dt === "bool") {
        const s = (v ?? "").toString().toLowerCase();
        if (!["true", "false", "1", "0", "sí", "si", "no", "t", "f", "yes", "y", "n"].includes(s))
          return `El campo ${k} debe ser Sí/No`;
        out[k] = ["true", "1", "sí", "si", "t", "yes", "y"].includes(s);
      } else {
        out[k] = v ?? "";
      }
    }
    return out as Record<string, any>;
  }

  /* =========================
     Sheet: crear/editar ítem NUEVO
  ========================= */
  async function openModal(clase: Clase, index: number | null = null) {
    setMsg(null);
    if (step !== 2) setStep(2);

    if (index !== null) {
      const row = temp[index];
      const schema = row.schema.length ? row.schema : await loadSchema(row.clase, row.tipo_nombre);
      setDraft({ ...row, schema, captured: row.captured || [] });
      setEditingIndex(index);
      setOpen(true);
      return;
    }
    setDraft({ clase, tipo_nombre: "", codigo: "", schema: [], specs: [], files: null, captured: [] });
    setEditingIndex(null);
    setOpen(true);
  }

  async function onChangeTipo(tipo: string) {
    if (!draft) return;
    const schema = await loadSchema(draft.clase, tipo);
    const codigo = await suggestCode(draft.clase, tipo);
    const mapped = schema.map((a) => {
      const prev = draft.specs.find((s) => s.k.toLowerCase() === a.nombre.toLowerCase())?.v;
      return { k: a.nombre, v: prev ?? "" };
    });
    setDraft({ ...draft, tipo_nombre: tipo, schema, specs: mapped, codigo });
  }

  function applyDraft() {
    if (!draft) return;
    if (!draft.tipo_nombre) return setMsg("Selecciona el tipo");
    if (!draft.codigo.trim()) return setMsg("Completa el código");
    const checked = validateSpecs(draft.specs, draft.schema) as Record<string, any> | string;
    if (typeof checked === "string") return setMsg(checked);
    if (editingIndex !== null) {
      setTemp((arr) => {
        const copy = [...arr];
        copy[editingIndex] = { ...draft };
        return copy;
      });
    } else {
      setTemp((arr) => [...arr, { ...draft }]);
    }
    setOpen(false);
  }

  function removeTemp(index: number) {
    setTemp((arr) => arr.filter((_, i) => i !== index));
  }

  /* =========================
     BORROW: Solicitar préstamos
  ========================= */
  const [borrowOpen, setBorrowOpen] = useState(false);
  const [areas, setAreas] = useState<AreaLite[]>([]);
  const [areasLoading, setAreasLoading] = useState(false);
  const [areaSel, setAreaSel] = useState<number | null>(null);
  const [borrowClase, setBorrowClase] = useState<Clase>("COMPONENTE");
  const [areaItems, setAreaItems] = useState<AreaItemRow[]>([]);
  const [areaItemsLoading, setAreaItemsLoading] = useState(false);
  const [picked, setPicked] = useState<Record<number, boolean>>({}); // item_id -> checked

  async function loadAreas() {
    setAreasLoading(true);
    try {
      const r = await http.get<AreaLite[]>("/api/areas", { params: { flat: 1 } });
      setAreas(r.data || []);
    } catch {
      setAreas([]);
    } finally {
      setAreasLoading(false);
    }
  }

  async function loadAreaItems(id: number, clase: Clase) {
    setAreaItemsLoading(true);
    setAreaItems([]);
    setPicked({});
    try {
      // Pedimos bastante por página para reducir llamadas; si necesitas más, implementa paginación aquí.
      const r = await http.get<{ items: AreaItemRow[]; total: number; page: number; size: number }>(
        `/api/areas/${id}/items`,
        { params: { clase, page: 1, size: 100 } }
      );
      const rows = (r.data?.items || []).filter(
        (x) => (x.estado || "").toUpperCase() === "ALMACEN" && !x.equipo
      );
      setAreaItems(rows);
    } catch {
      setAreaItems([]);
    } finally {
      setAreaItemsLoading(false);
    }
  }

  function openBorrow() {
    setBorrowOpen(true);
    if (areas.length === 0) loadAreas();
  }

  function togglePick(id: number) {
    setPicked((m) => ({ ...m, [id]: !m[id] }));
  }

  function confirmBorrowSelection() {
    const rows = areaItems.filter((x) => picked[x.item_id]);
    if (rows.length === 0) return;
    const adds = rows.map((r) => ({
      item_id: r.item_id,
      item_codigo: r.item_codigo,
      clase: r.clase,
      tipo: r.tipo,
      area_origen: areaSel as number,
    }));
    // no duplicar si ya está seleccionado
    setPrestamos((prev) => {
      const ids = new Set(prev.map((p) => p.item_id));
      const merged = [...prev];
      for (const a of adds) if (!ids.has(a.item_id)) merged.push(a);
      return merged;
    });
    setBorrowOpen(false);
  }

  /* =========================
     Guardar
  ========================= */
  async function guardarEquipo() {
    setMsg(null);

    if (!form.nombre.trim() || !form.codigo.trim()) {
      setMsg("Código y nombre del equipo son requeridos");
      setStep(1);
      return;
    }
    if (temp.length === 0 && prestamos.length === 0) {
      setMsg("Agrega ítems nuevos o selecciona préstamos");
      setStep(2);
      return;
    }

    setSaving(true);
    try {
      let equipo_id = eidParam;

      // 1) Crear equipo (solo modo crear)
      if (!isAppend) {
        const payload = {
          codigo: form.codigo.trim(),
          nombre: form.nombre.trim(),
          estado: "USO",
          usuario_final: form.usuario_final?.trim() || null,
          login: form.login?.trim() || null,
          password: form.password?.trim() || null,
          items: [],
        };
        async function postOnce(p: typeof payload) {
          return http.post<{ equipo_id: number }>(`/api/areas/${currentAreaId}/equipos`, p);
        }
        try {
          const creq = await postOnce(payload);
          equipo_id = creq.data.equipo_id;
        } catch (e: any) {
          const txt = e?.response?.data?.error || "";
          const isDup = /duplicad.|llave duplicada|duplicate/i.test(txt);
          if (isDup) {
            const sug = await http.get<{ next_code: string }>(
              `/api/areas/${currentAreaId}/equipos/next-code`,
              { params: { prefix: "PC-", pad: 3 } }
            );
            const next_code = sug.data?.next_code;
            if (!next_code) throw e;
            const creq2 = await postOnce({ ...payload, codigo: next_code });
            equipo_id = creq2.data.equipo_id;
          } else {
            throw e;
          }
        }
      }

      // 2) Ítems NUEVOS: crear + media + asignar (+ opcional prestar movimiento)
      for (const row of temp) {
        const specsObj = validateSpecs(row.specs, row.schema) as Record<string, any>;
        const ir = await http.post<{ item_id: number }>("/api/items", {
          codigo: row.codigo.trim(),
          clase: row.clase,
          tipo_nombre: row.tipo_nombre,
          area_id: currentAreaId, // se crea en el área del equipo
          specs: specsObj,
        });
        const item_id = ir.data.item_id;

        const captured = row.captured || [];
        const selected = row.files ? Array.from(row.files) : [];
        const blobs: File[] = [...selected, ...captured];
        if (blobs.length > 0) {
          const fd = new FormData();
          blobs.forEach((f) => fd.append("files", f));
          await http.post(`/api/items/${item_id}/media`, fd, { headers: { "Content-Type": "multipart/form-data" } });
        }

        await http.post(`/api/equipos/${equipo_id}/items`, { item_id, slot: null });

        if (registrarPrestamoNuevos) {
          try {
            await http.post(`/api/items/${item_id}/prestar`, {
              destino_area_id: currentAreaId,
              detalle: { equipo_id, motivo: "CREACION_EQUIPO_USO" }
            });
          } catch {
            // no bloquear por un préstamo decorativo
          }
        }
      }

      // 3) Ítems en PRÉSTAMO: prestar + asignar
      for (const p of prestamos) {
        try {
          await http.post(`/api/items/${p.item_id}/prestar`, {
            destino_area_id: currentAreaId,
            detalle: { equipo_id, motivo: "PRESTAMO_A_EQUIPO_USO", desde_area_id: p.area_origen }
          });
        } catch (e: any) {
          // si ya estaban prestados o similar, continuamos e intentamos asignar
        }
        const assignRes = await http.post(`/api/equipos/${equipo_id}/items`, { item_id: p.item_id, slot: null }).catch((e) => e);
        if (assignRes?.response?.status === 400) {
          throw new Error(assignRes.response?.data?.error || "No se pudo asignar un préstamo al equipo");
        }
      }

      // 4) Ir al detalle
      nav(`/equipos/${equipo_id}`);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || e?.message || "No se pudo completar la operación");
    } finally {
      setSaving(false);
    }
  }

  /* =========================
     Derivados UI
  ========================= */
  const tempSlice = useMemo(() => temp.slice((tPage - 1) * tSize, tPage * tSize), [temp, tPage, tSize]);
  const totalTPages = Math.max(1, Math.ceil(temp.length / tSize));

  /* =========================
     Render
  ========================= */
  return (
    <div className={`${BG_APP}`}>
      <div className="max-w-7xl mx-auto p-3 sm:p-5 space-y-5">
        {/* Header + Steps */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-lg md:text-xl font-semibold">
            {isAppend ? "Agregar ítems en USO a equipo" : "Nuevo equipo en USO"}
          </h1>

          <div className="flex items-center text-sm w-full sm:w-auto justify-between sm:justify-end gap-2">
            {([1, 2, 3] as const).map((n, i) => (
              <div key={n} className="flex items-center flex-1 sm:flex-none">
                <button
                  onClick={() => setStep(n)}
                  className={`w-10 h-10 rounded-full border flex items-center justify-center ${
                    step === n
                      ? `bg-[${BRAND}] text-slate-800 border-[${BRAND}]`
                      : "bg-white border-slate-300"
                  }`}
                  title={n === 1 ? "Datos" : n === 2 ? "Ítems" : "Revisar"}
                  disabled={isAppend && n === 1}
                >
                  {n}
                </button>
                {i < 2 && <div className="hidden sm:block w-12 h-[2px] bg-slate-300 mx-2" />}
              </div>
            ))}
          </div>
        </div>

        {msg && <div className="p-3 md:p-4 rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-200">{msg}</div>}

        {/* Paso 1 */}
        {!isAppend && step === 1 && (
          <section className={card + " p-4 sm:p-5 space-y-4"}>
            <div className="text-base md:text-lg font-semibold">1) Datos del equipo</div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="text-xs text-slate-600 block mb-1">Código</label>
                <input
                  className={fieldBase}
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Ej. PC-001"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 block mb-1">Nombre</label>
                <input
                  className={fieldBase}
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Nombre visible del equipo"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 block mb-1">Estado</label>
                <input className={fieldReadOnly} value="USO" readOnly />
              </div>

              <div>
                <label className="text-xs text-slate-600 block mb-1">Usuario final</label>
                <input
                  className={fieldBase}
                  value={form.usuario_final}
                  onChange={(e) => setForm({ ...form, usuario_final: e.target.value })}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Persona que usa el equipo"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 block mb-1">Login</label>
                <input
                  className={fieldBase}
                  value={form.login}
                  onChange={(e) => setForm({ ...form, login: e.target.value })}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Cuenta de acceso"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 block mb-1">Password</label>
                <input
                  type="text"
                  className={fieldBase}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  id="chPrestamoNuevos"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={registrarPrestamoNuevos}
                  onChange={(e) => setRegistrarPrestamoNuevos(e.target.checked)}
                />
                <label htmlFor="chPrestamoNuevos" className="text-sm">
                  Registrar movimientos como <b>PRÉSTAMO</b> para ítems nuevos
                </label>
              </div>

              <button
                className={btnPrimary}
                onClick={() => setStep(2)}
                disabled={!form.codigo.trim() || !form.nombre.trim()}
              >
                Continuar
              </button>
            </div>
          </section>
        )}

        {/* Paso 1 (informativo en append) */}
        {isAppend && step === 1 && equipoHeader && (
          <section className={card + " p-4 sm:p-5 space-y-2"}>
            <div className="text-base md:text-lg font-semibold">1) Datos del equipo</div>
            <div className={`${textMuted} text-sm`}>
              Editando equipo: <span className="font-mono">{equipoHeader.equipo_codigo}</span> — {equipoHeader.equipo_nombre} · Área{" "}
              <span className="font-medium">{equipoHeader.area_id}</span>{" "}
              <Link className="underline" to={`/equipos/${equipoHeader.equipo_id}`}>ver detalle</Link>
            </div>
          </section>
        )}

        {/* Paso 2 */}
        {step === 2 && (
          <section className={card + " p-4 sm:p-5 space-y-4"}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-base md:text-lg font-semibold">
                2) Ítems para el equipo
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button className={btnBase + " w-full sm:w-auto"} onClick={() => openModal("COMPONENTE")}>
                  + Componente nuevo
                </button>
                <button className={btnBase + " w-full sm:w-auto"} onClick={() => openModal("PERIFERICO")}>
                  + Periférico nuevo
                </button>
                <button className={btnBase + " w-full sm:w-auto"} onClick={openBorrow}>
                  🔄 Solicitar préstamos
                </button>
              </div>
            </div>

            {/* NUEVOS EN USO */}
            <div className="rounded-2xl ring-1 ring-slate-200 overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b text-sm font-medium">Nuevos ítems en uso</div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr className="text-left text-slate-600">
                      <th className="px-3 py-2">Clase</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Código</th>
                      <th className="px-3 py-2">Ficha</th>
                      <th className="px-3 py-2">Imágenes</th>
                      <th className="px-3 py-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tempSlice.map((r, i) => {
                      const idx = (tPage - 1) * tSize + i;
                      const imgCount = (r.files?.length || 0) + (r.captured?.length || 0);
                      return (
                        <tr key={`tmp-${idx}`} className={`border-t hover:bg-slate-50 ${i % 2 ? "bg-slate-50/40" : "bg-white"}`}>
                          <td className="px-3 py-2">{r.clase}</td>
                          <td className="px-3 py-2">{r.tipo_nombre || "-"}</td>
                          <td className="px-3 py-2">{r.codigo}</td>
                          <td className="px-3 py-2">
                            {r.specs.filter((s) => (s.v ?? "") !== "").length}/{r.schema.length}
                          </td>
                          <td className="px-3 py-2">{imgCount}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-2">
                              <button className={btnBase} onClick={() => openModal(r.clase, idx)}>Editar</button>
                              <button className={btnBase} onClick={() => removeTemp(idx)}>Quitar</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {temp.length === 0 && (
                      <tr>
                        <td className="px-3 py-6 text-slate-500" colSpan={6}>
                          Aún no agregas ítems nuevos
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between p-3 border-t">
                <div className="text-sm text-slate-600">
                  Página {Math.min(tPage, totalTPages)} de {totalTPages} · {temp.length} ítems
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button className={btnBase + " flex-1 sm:flex-none"} disabled={tPage <= 1} onClick={() => setTPage((p) => p - 1)}>◀</button>
                  <select className={selectBase + " w-full sm:w-auto py-1.5"} value={tSize} onChange={(e) => { setTPage(1); setTSize(Number(e.target.value)); }}>
                    {[5, 10, 20, 50].map((s) => <option key={s} value={s}>{s} / pág</option>)}
                  </select>
                  <button className={btnBase + " flex-1 sm:flex-none"} disabled={tPage >= totalTPages} onClick={() => setTPage((p) => p + 1)}>▶</button>
                </div>
              </div>
            </div>

            {/* PRÉSTAMOS SELECCIONADOS */}
            <div className="rounded-2xl ring-1 ring-slate-200 overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b text-sm font-medium">
                Préstamos seleccionados <span className="text-slate-500">({prestamos.length})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-slate-600">
                      <th className="px-3 py-2">Clase</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Código</th>
                      <th className="px-3 py-2">Área origen</th>
                      <th className="px-3 py-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prestamos.map((p, i) => (
                      <tr key={`pre-${p.item_id}`} className={`border-t ${i % 2 ? "bg-slate-50/40" : "bg-white"}`}>
                        <td className="px-3 py-2">{p.clase}</td>
                        <td className="px-3 py-2">{p.tipo}</td>
                        <td className="px-3 py-2 font-mono">{p.item_codigo}</td>
                        <td className="px-3 py-2">{p.area_origen}</td>
                        <td className="px-3 py-2 text-right">
                          <button className={btnBase} onClick={() => setPrestamos((arr) => arr.filter((x) => x.item_id !== p.item_id))}>
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                    {prestamos.length === 0 && (
                      <tr><td className="px-3 py-6 text-slate-500" colSpan={5}>No has seleccionado préstamos aún</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-2">
              {!isAppend ? (
                <button className={btnBase} onClick={() => setStep(1)}>
                  Volver
                </button>
              ) : (
                <Link to={`/equipos/${eidParam}`} className={btnBase}>
                  Volver al detalle
                </Link>
              )}
              <button
                className={btnPrimary}
                onClick={() => setStep(3)}
                disabled={temp.length === 0 && prestamos.length === 0}
              >
                Continuar
              </button>
            </div>
          </section>
        )}

        {/* Paso 3 */}
        {step === 3 && (
          <section className={card + " p-4 sm:p-5 space-y-4"}>
            <div className="text-base md:text-lg font-semibold">3) Revisar y guardar</div>

            <div className="grid gap-4 md:gap-5 md:grid-cols-2">
              <div className="rounded-2xl ring-1 ring-slate-200 p-3 sm:p-4">
                <div className="font-medium mb-2">Equipo</div>
                <div className="text-sm space-y-1.5">
                  <div><span className="text-slate-500">Código:</span> {form.codigo}</div>
                  <div><span className="text-slate-500">Nombre:</span> {form.nombre}</div>
                  <div><span className="text-slate-500">Estado:</span> USO</div>
                  {form.usuario_final && (<div><span className="text-slate-500">Usuario final:</span> {form.usuario_final}</div>)}
                  {form.login && (<div><span className="text-slate-500">Login:</span> {form.login}</div>)}
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      id="chPrestamoRev"
                      type="checkbox"
                      className="h-4 w-4"
                      checked={registrarPrestamoNuevos}
                      onChange={(e) => setRegistrarPrestamoNuevos(e.target.checked)}
                    />
                    <label htmlFor="chPrestamoRev" className="text-sm">
                      Registrar movimientos como <b>PRÉSTAMO</b> para ítems nuevos
                    </label>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl ring-1 ring-slate-200 p-3 sm:p-4">
                <div className="font-medium mb-2">Resumen</div>
                <div className="text-sm space-y-1.5">
                  <div>Nuevos: {temp.length}</div>
                  <div>Préstamos: {prestamos.length}</div>
                  <div>Componentes: {temp.filter((t) => t.clase === "COMPONENTE").length + prestamos.filter((t) => t.clase === "COMPONENTE").length}</div>
                  <div>Periféricos: {temp.filter((t) => t.clase === "PERIFERICO").length + prestamos.filter((t) => t.clase === "PERIFERICO").length}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-2">
              <button className={btnBase} onClick={() => setStep(2)}>
                Volver
              </button>
              <button
                className={btnPrimary}
                disabled={saving}
                onClick={guardarEquipo}
              >
                {saving ? "Guardando..." : isAppend ? "Agregar al equipo" : "Guardar equipo"}
              </button>
            </div>
          </section>
        )}

        {/* Sheet crear/editar ítem NUEVO */}
        <Sheet
          open={open}
          onClose={() => setOpen(false)}
          title={editingIndex !== null ? "Editar ítem" : "Agregar ítem"}
          footer={
            <div className="flex items-center justify-end gap-2">
              <button className={btnBase} onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button className={btnPrimary} onClick={applyDraft}>
                {editingIndex !== null ? "Actualizar" : "Agregar"}
              </button>
            </div>
          }
        >
          {draft && (
            <div className="p-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Clase</label>
                  <input className={fieldReadOnly} readOnly value={draft.clase} />
                </div>
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Tipo</label>
                  <select className={selectBase} value={draft.tipo_nombre} onChange={(e) => onChangeTipo(e.target.value)}>
                    <option value="">Seleccione…</option>
                    {(draft.clase === "COMPONENTE" ? typesC : typesP).map((t) => (
                      <option key={t.id} value={t.nombre}>{t.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-slate-600 block mb-1">Código</label>
                  <input
                    className={fieldBase}
                    value={draft.codigo}
                    onChange={(e) => setDraft({ ...draft, codigo: e.target.value })}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Se sugiere al elegir tipo"
                  />
                </div>
              </div>

              {/* Imágenes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-600">Imágenes</label>
                  <div className="flex items-center gap-2">
                    <label className={btnBase + " text-sm cursor-pointer"}>
                      Subir / Cámara
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => setDraft({ ...draft, files: e.target.files })}
                        title="Abrirá cámara en móvil o galería/archivos"
                      />
                    </label>
                    <button type="button" className={btnBase + " text-sm"} onClick={() => setShowCam(true)}>
                      📷 Tomar foto
                    </button>
                  </div>
                </div>
                <div className="text-xs text-slate-600">
                  Listas para subir: <span className="font-semibold">
                    {(draft.files?.length || 0) + (draft.captured?.length || 0)}
                  </span>{" "}
                  {draft.files?.length ? `(seleccionadas: ${draft.files.length}) ` : ""}
                  {draft.captured?.length ? `(capturadas: ${draft.captured.length})` : ""}
                </div>
              </div>

              {/* Ficha técnica */}
              <div className="space-y-2">
                {draft.schema.length === 0 ? (
                  <div className="text-sm text-slate-500">Selecciona un tipo para ver la ficha…</div>
                ) : (
                  draft.schema.map((a) => {
                    const cur = draft.specs.find((s) => s.k.toLowerCase() === a.nombre.toLowerCase())?.v ?? "";
                    return (
                      <div key={`spec-${a.nombre}`}>
                        <div className="text-xs text-slate-600 mb-1">
                          {a.nombre} <span className="text-slate-400">({a.data_type})</span>
                        </div>
                        {a.data_type === "bool" ? (
                          <select
                            className={selectBase}
                            value={cur}
                            onChange={(e) => {
                              const v = e.target.value;
                              setDraft((d) => {
                                if (!d) return d;
                                const next = d.specs.some((s) => s.k === a.nombre)
                                  ? d.specs.map((s) => (s.k === a.nombre ? { ...s, v } : s))
                                  : [...d.specs, { k: a.nombre, v }];
                                return { ...d, specs: next };
                              });
                            }}
                          >
                            <option value="">--</option>
                            <option value="true">Sí</option>
                            <option value="false">No</option>
                          </select>
                        ) : a.data_type === "date" ? (
                          <input
                            type="date"
                            className={fieldBase}
                            value={cur}
                            onChange={(e) => {
                              const v = e.target.value;
                              setDraft((d) => {
                                if (!d) return d;
                                const next = d.specs.some((s) => s.k === a.nombre)
                                  ? d.specs.map((s) => (s.k === a.nombre ? { ...s, v } : s))
                                  : [...d.specs, { k: a.nombre, v }];
                                return { ...d, specs: next };
                              });
                            }}
                          />
                        ) : (
                          <input
                            className={fieldBase}
                            placeholder={a.data_type === "int" ? "entero" : a.data_type === "numeric" ? "decimal" : "texto"}
                            value={cur}
                            onChange={(e) => {
                              const v = e.target.value;
                              setDraft((d) => {
                                if (!d) return d;
                                const next = d.specs.some((s) => s.k === a.nombre)
                                  ? d.specs.map((s) => (s.k === a.nombre ? { ...s, v } : s))
                                  : [...d.specs, { k: a.nombre, v }];
                                return { ...d, specs: next };
                              });
                            }}
                            autoComplete="off"
                            spellCheck={false}
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </Sheet>

        {/* Sheet: PRÉSTAMOS */}
        <Sheet
          open={borrowOpen}
          onClose={() => setBorrowOpen(false)}
          title="Solicitar préstamos"
          footer={
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Seleccionados: {Object.values(picked).filter(Boolean).length}
              </div>
              <div className="flex items-center gap-2">
                <button className={btnBase} onClick={() => setBorrowOpen(false)}>Cancelar</button>
                <button className={btnPrimary} onClick={confirmBorrowSelection} disabled={Object.values(picked).every((v) => !v)}>
                  Agregar a préstamos
                </button>
              </div>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-3 h-full">
            {/* Col 1: Áreas */}
            <div className="border-r md:h-[calc(100vh-10rem)] overflow-y-auto p-3">
              <div className="text-sm font-medium mb-2">Áreas</div>
              {areasLoading && <div className="text-sm text-slate-500">Cargando áreas…</div>}
              {!areasLoading && areas.length === 0 && <div className="text-sm text-slate-500">No hay áreas</div>}
              <div className="space-y-1">
                {areas.map((a) => (
                  <button
                    key={a.id}
                    className={`w-full text-left px-3 py-2 rounded-xl border ${
                      areaSel === a.id ? `bg-[${BRAND}] text-slate-800 border-[${BRAND}]` : "bg-white hover:bg-slate-50 border-slate-300"
                    }`}
                    onClick={() => {
                      setAreaSel(a.id);
                      loadAreaItems(a.id, borrowClase);
                    }}
                  >
                    <div className="text-sm">{a.nombre}</div>
                    <div className="text-xs opacity-70">ID: {a.id}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Col 2-3: Ítems */}
            <div className="md:col-span-2 p-3 md:h-[calc(100vh-10rem)] overflow-y-auto">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <button
                    className={`${btnBase} ${borrowClase === "COMPONENTE" ? `bg-[${BRAND}] text-slate-800 border-[${BRAND}]` : ""}`}
                    onClick={() => {
                      setBorrowClase("COMPONENTE");
                      if (areaSel) loadAreaItems(areaSel, "COMPONENTE");
                    }}
                  >
                    Componentes
                  </button>
                  <button
                    className={`${btnBase} ${borrowClase === "PERIFERICO" ? `bg-[${BRAND}] text-slate-800 border-[${BRAND}]` : ""}`}
                    onClick={() => {
                      setBorrowClase("PERIFERICO");
                      if (areaSel) loadAreaItems(areaSel, "PERIFERICO");
                    }}
                  >
                    Periféricos
                  </button>
                </div>
                <div className={`${textMuted} text-sm`}>
                  {areaSel ? `Área ID ${areaSel}` : "Selecciona un área"}
                </div>
              </div>

              {!areaSel && <div className="text-sm text-slate-500">Elige un área para ver los ítems disponibles</div>}
              {areaSel && areaItemsLoading && <div className="text-sm text-slate-500">Cargando ítems libres…</div>}
              {areaSel && !areaItemsLoading && areaItems.length === 0 && (
                <div className="text-sm text-slate-500">No hay ítems libres en ALMACEN para esta clase</div>
              )}

              {areaSel && !areaItemsLoading && areaItems.length > 0 && (
                <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-slate-600">
                        <th className="px-3 py-2 w-10"></th>
                        <th className="px-3 py-2">Código</th>
                        <th className="px-3 py-2">Tipo</th>
                        <th className="px-3 py-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {areaItems.map((r, i) => (
                        <tr key={r.item_id} className={`border-t ${i % 2 ? "bg-slate-50/40" : "bg-white"}`}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={!!picked[r.item_id]}
                              onChange={() => togglePick(r.item_id)}
                            />
                          </td>
                          <td className="px-3 py-2 font-mono">{r.item_codigo}</td>
                          <td className="px-3 py-2">{r.tipo}</td>
                          <td className="px-3 py-2">{r.estado}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Sheet>

        {/* Cámara embebida para el Sheet NUEVOS */}
        {showCam && draft && (
          <CamSheet
            onClose={() => setShowCam(false)}
            onCapture={(file) =>
              setDraft((d) => {
                if (!d) return d;
                const prev = d.captured || [];
                return { ...d, captured: [...prev, file] };
              })
            }
          />
        )}
      </div>
    </div>
  );
}

/* ======= Cámara embebida (getUserMedia) ======= */
function CamSheet({ onClose, onCapture }: { onClose: () => void; onCapture: (f: File) => void }) {
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  // ref global para no re-crear stream
  const streamRef = (window as any).__equiponuevo_stream_ref ?? { current: null as MediaStream | null };
  (window as any).__equiponuevo_stream_ref = streamRef;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!streamRef.current) {
          const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
          if (cancelled) { s.getTracks().forEach(t => t.stop()); return; }
          streamRef.current = s;
        }
        const v = videoEl;
        if (v && v.srcObject !== streamRef.current) {
          (v as any).srcObject = streamRef.current;
          try { await (v as any).play?.(); } catch {}
          setReady(true);
        }
      } catch { onClose(); }
    })();
    return () => {
      cancelled = true;
      const s = streamRef.current;
      streamRef.current = null;
      s?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoEl]);

  async function capture() {
    if (!videoEl) return;
    const w = (videoEl as any).videoWidth || 1280;
    const h = (videoEl as any).videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(videoEl, 0, 0, w, h);
    const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b as Blob), "image/jpeg", 0.8)!);
    const file = new File([blob], `cam_${Date.now()}.jpg`, { type: "image/jpeg" });
    onCapture(file);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow w-full max-w-md overflow-hidden">
        <div className="px-4 py-3 border-b font-semibold">Cámara</div>
        <div className="p-3">
          <video ref={setVideoEl} autoPlay playsInline muted className="w-full rounded-lg bg-black" style={{ aspectRatio: "16/9", objectFit: "cover" }} />
        </div>
        <div className="px-4 py-3 border-t flex items-center justify-between">
          <button className="px-3 py-2 rounded-lg border" onClick={onClose}>Cerrar</button>
          <button
            className="px-4 py-2 rounded-lg bg-[#80F9FA] text-slate-800 hover:bg-[#6ee7e9] active:bg-[#4fd4d7] disabled:opacity-50"
            disabled={!ready}
            onClick={capture}
          >
            Tomar foto
          </button>
        </div>
      </div>
    </div>
  );
}
