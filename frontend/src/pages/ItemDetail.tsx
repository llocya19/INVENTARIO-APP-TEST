// src/pages/ItemDetail.tsx
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import http from "../api/http";

/* ====== Tipos ====== */
type ItemDetail = {
  item_id: number;
  item_codigo: string;
  clase: "COMPONENTE" | "PERIFERICO";
  tipo: string;
  estado: string;
  area_id: number;
  area_nombre: string;
  ficha: Record<string, any>;
  fotos: { path: string; principal: boolean; orden: number | null; created_at?: string }[];
  created_at?: string;
};
type Attr = {
  nombre: string;
  data_type: "text" | "int" | "numeric" | "bool" | "date";
  orden?: number | null;
};

/* =========================
   Tema Hospital – Crema + Blanco + Turquesa
========================= */
const BRAND = "#80F9FA";
const BG_APP = "bg-[#FFFDF8]";
const TEXT = "text-slate-800";
const MUTED = "text-slate-600";

const section = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const cardBase = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const card = cardBase + " p-4 md:p-5";
const baseText = "leading-relaxed tracking-[0.01em]";

const focusRing =
  `focus:outline-none focus:ring-2 focus:ring-[${BRAND}]/40 focus:border-[${BRAND}]`;
const fieldBase =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-base placeholder-slate-400 " +
  TEXT +
  " " +
  focusRing +
  " transition";

const btnBase =
  `inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base ${TEXT}
   hover:border-[${BRAND}] hover:bg-[#F0FEFE] active:bg-[#E1FDFD] transition disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[88px]`;
const btnPrimary =
  `inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-base bg-[${BRAND}] text-slate-800 font-medium
   hover:bg-[#6ee7e9] active:bg-[#4fd4d7] transition disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[112px]`;
const btnAccent =
  `inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-base bg-sky-600 text-white font-medium
   hover:bg-sky-500 active:bg-sky-700 transition disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[112px]`;

function Chip({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "emerald" | "amber" | "rose" | "brand";
}) {
  const map = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-800",
    rose: "bg-rose-100 text-rose-700",
    brand: "bg-[#E6FEFF] text-slate-800", // turquesa suave
  } as const;
  return <span className={`text-[11px] px-2 py-0.5 rounded-full ${map[tone]}`}>{children}</span>;
}

/* ====== Página ====== */
export default function ItemDetailPage() {
  const { id } = useParams();
  const itemId = Number(id);

  const [data, setData] = useState<ItemDetail | null>(null);
  const [schema, setSchema] = useState<Attr[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // edición masiva
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [savingAll, setSavingAll] = useState(false);

  // nuevo atributo
  const [showNewAttr, setShowNewAttr] = useState(false);
  const [newAttr, setNewAttr] = useState<{ nombre: string; data_type: Attr["data_type"] }>({
    nombre: "",
    data_type: "text",
  });

  // upload
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);

  // cámara embebida
  const [showCam, setShowCam] = useState(false);
  const [captured, setCaptured] = useState<File[]>([]);

  // accesibilidad modal nuevo atributo
  const newAttrModalRef = useRef<HTMLDivElement | null>(null);
  const newAttrCloseBtnRef = useRef<HTMLButtonElement | null>(null);

  // selección + confirmación + paginación fotos
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmTargets, setConfirmTargets] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  const [photoPage, setPhotoPage] = useState(1);
  const [photoSize, setPhotoSize] = useState(6);

  // toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const ficha = useMemo(() => data?.ficha || {}, [data]);

  async function load() {
    setLoading(true);
    setMsg(null);
    setOk(null);
    try {
      const r = await http.get<ItemDetail>(`/api/items/${itemId}`);
      setData(r.data);

      const attrs = await http.get<Attr[]>(`/api/spec/attrs`, {
        params: { clase: r.data.clase, tipo: r.data.tipo },
      });
      setSchema(attrs.data);

      const initial: Record<string, any> = {};
      const d: Record<string, boolean> = {};
      attrs.data.forEach((a) => {
        const k = a.nombre.toLowerCase();
        initial[a.nombre] = r.data.ficha?.[k] ?? "";
        d[a.nombre] = false;
      });
      setEditValues(initial);
      setDirty(d);
      setSelectedPaths(new Set());
      setPhotoPage(1);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo cargar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (Number.isFinite(itemId)) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  useEffect(() => {
    if (!ok) return;
    const t = setTimeout(() => setOk(null), 2500);
    return () => clearTimeout(t);
  }, [ok]);

  function normalize(dt: Attr["data_type"], raw: any): { ok: boolean; val?: any; err?: string } {
    if (dt === "int") {
      const n = Number.parseInt((raw ?? "").toString().replace(/[^\d-]/g, ""), 10);
      if (Number.isNaN(n)) return { ok: false, err: "Debe ser entero" };
      return { ok: true, val: n };
    }
    if (dt === "numeric") {
      const norm = (raw ?? "").toString().replace(",", ".").replace(/[^0-9.\-]/g, "");
      const x = Number.parseFloat(norm);
      if (Number.isNaN(x)) return { ok: false, err: "Debe ser decimal" };
      return { ok: true, val: x };
    }
    if (dt === "bool") {
      const s = (raw ?? "").toString().toLowerCase();
      if (!["true", "false", "1", "0", "sí", "si", "no", "t", "f", "yes", "y", "n"].includes(s)) {
        return { ok: false, err: "Debe ser Sí/No" };
      }
      return { ok: true, val: ["true", "1", "sí", "si", "t", "yes", "y"].includes(s) };
    }
    return { ok: true, val: raw ?? "" };
  }

  const dirtyCount = useMemo(() => Object.values(dirty).filter(Boolean).length, [dirty]);

  async function saveAll() {
    if (!data) return;
    setSavingAll(true);
    setMsg(null);
    setOk(null);

    try {
      for (const a of schema) {
        if (!dirty[a.nombre]) continue;
        const raw = editValues[a.nombre];
        const { ok: isOk, val, err } = normalize(a.data_type, raw);
        if (!isOk) {
          setMsg(`"${a.nombre}": ${err}`);
          setSavingAll(false);
          return;
        }
        await http.post(`/api/items/${itemId}/specs`, {
          attr: a.nombre,
          data_type: a.data_type,
          value: val,
          clase: data.clase,
          tipo_nombre: data.tipo,
        });
      }

      await load();
      setOk("Cambios guardados");
      setToastMsg("Ficha técnica guardada");
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudieron guardar los cambios");
      setToastMsg("No se pudieron guardar los cambios");
    } finally {
      setSavingAll(false);
    }
  }

  async function uploadPhotos() {
    const blobs: File[] = [];
    if (files && files.length > 0) blobs.push(...Array.from(files));
    if (captured.length > 0) blobs.push(...captured);
    if (blobs.length === 0) return;

    setUploading(true);
    setMsg(null);
    setOk(null);
    try {
      const fd = new FormData();
      blobs.forEach((f) => fd.append("files", f));
      await http.post(`/api/items/${itemId}/media`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setFiles(null);
      setCaptured([]);
      setShowCam(false);
      await load();
      setOk("Imágenes subidas");
      setToastMsg("Imágenes subidas");
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudieron subir las imágenes");
      setToastMsg("No se pudieron subir las imágenes");
    } finally {
      setUploading(false);
    }
  }

  // ---- Borrado con selección y confirmación amigable
  function askDeleteSingle(path: string) {
    setConfirmTargets([path]);
    setShowConfirm(true);
  }
  function askDeleteSelected() {
    if (selectedPaths.size === 0) return;
    setConfirmTargets(Array.from(selectedPaths));
    setShowConfirm(true);
  }

  async function deletePhotos(paths: string[]) {
    if (paths.length === 0) return;
    setDeleting(true);
    setMsg(null);
    setOk(null);
    try {
      await Promise.all(paths.map((p) => http.delete(`/api/items/${itemId}/media`, { data: { path: p } })));
      await load();
      setOk(paths.length === 1 ? "Imagen eliminada" : "Imágenes eliminadas");
      setToastMsg(paths.length === 1 ? "Imagen eliminada" : "Imágenes eliminadas");
      setSelectedPaths(new Set());
    } catch (e: any) {
      const err = e?.response?.data?.error || "No se pudieron eliminar una o más imágenes";
      setMsg(err);
      setToastMsg(err);
    } finally {
      setDeleting(false);
      setShowConfirm(false);
      setConfirmTargets([]);
    }
  }

  /* ====== Thumbs (pendientes) ====== */
  const selected = useMemo(() => (files ? Array.from(files) : []), [files]);
  const selectedCount = (files?.length || 0) + captured.length;

  // ====== Paginación de fotos existentes ======
  const fotos = data?.fotos ?? [];
  const photoTotalPages = Math.max(1, Math.ceil(fotos.length / photoSize));
  useEffect(() => {
    if (photoPage > photoTotalPages) setPhotoPage(photoTotalPages);
  }, [photoTotalPages, photoPage]);
  const photoStart = (photoPage - 1) * photoSize;
  const photoSlice = fotos.slice(photoStart, photoStart + photoSize);

  if (loading)
    return (
      <div className={`${BG_APP} ${TEXT} min-h-[calc(100vh-64px)]`}>
        <div className="max-w-7xl mx-auto px-4 py-6">Cargando…</div>
      </div>
    );
  if (!data)
    return (
      <div className={`${BG_APP} ${TEXT} min-h-[calc(100vh-64px)]`}>
        <div className="max-w-7xl mx-auto px-4 py-6">{msg || "No encontrado"}</div>
      </div>
    );

  return (
    <div className={`${BG_APP} ${TEXT} min-h-[calc(100vh-64px)]`}>
      <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 py-5 space-y-5">
        {/* Header */}
        <div className={`${section} px-4 py-4 md:px-6 md:py-5 ${baseText}`}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1">
              <Link to={`/areas/${data.area_id}`} className={MUTED + " hover:underline"}>
                ← Volver a área
              </Link>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[22px] md:text-[26px] font-semibold">{data.item_codigo}</h2>
                <Chip tone="brand">{data.clase}</Chip>
                <Chip tone="emerald">{data.estado}</Chip>
                <Chip tone="amber">{data.tipo}</Chip>
              </div>
              <div className={MUTED + " text-sm flex items-center gap-2 flex-wrap"}>
                <span>
                  Área: <b>{data.area_nombre}</b>
                </span>
                {data.created_at && (
                  <>
                    <span className="text-slate-400">·</span>
                    <span>
                      Registrado: <b>{new Date(data.created_at).toLocaleString()}</b>
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className={btnPrimary}
                onClick={saveAll}
                disabled={savingAll || dirtyCount === 0}
                title={dirtyCount === 0 ? "Sin cambios" : `Hay ${dirtyCount} cambio(s)`}
              >
                {savingAll ? "Guardando…" : "Guardar cambios"}
              </button>
              <button className={btnBase} onClick={() => setShowNewAttr(true)} title="Crear nuevo campo para este tipo">
                + Nuevo campo
              </button>
            </div>
          </div>
        </div>

        {/* Mensajes inline */}
        {msg && <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800">{msg}</div>}
        {ok && (
          <div className={`p-3 rounded-xl border border-[${BRAND}]/50 bg-[#E6FEFF] text-slate-800`}>
            {ok}
          </div>
        )}

        {/* Split */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* FICHA técnica */}
          <section className={card + " " + baseText}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Ficha técnica</h3>
              <span className={MUTED + " text-sm"}>
                {schema.length} {schema.length === 1 ? "campo" : "campos"}
              </span>
            </div>

            {schema.length === 0 ? (
              <div className="text-slate-500">Este tipo aún no tiene campos.</div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white">
                {/* Scroll container */}
                <div className="max-h-[440px] overflow-y-auto p-4 pr-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {schema.map((a) => {
                      const kLower = a.nombre.toLowerCase();
                      const original = ficha[kLower] ?? "";
                      const current = editValues[a.nombre] ?? "";
                      const isDirty = current !== original;

                      return (
                        <label key={a.nombre} className="block">
                          <span className={MUTED + " text-sm"}>{a.nombre}</span>
                          <div className="mt-1">
                            {a.data_type === "bool" ? (
                              <select
                                className={fieldBase}
                                value={String(current)}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setEditValues((prev) => ({ ...prev, [a.nombre]: v }));
                                  setDirty((d) => ({ ...d, [a.nombre]: v !== String(original) }));
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
                                value={current}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setEditValues((prev) => ({ ...prev, [a.nombre]: v }));
                                  setDirty((d) => ({ ...d, [a.nombre]: v !== original }));
                                }}
                              />
                            ) : (
                              <input
                                className={`${fieldBase} ${isDirty ? "ring-2 ring-amber-200 border-amber-300" : ""}`}
                                placeholder={a.data_type === "int" ? "entero" : a.data_type === "numeric" ? "decimal" : "texto"}
                                value={current}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setEditValues((prev) => ({ ...prev, [a.nombre]: v }));
                                  setDirty((d) => ({ ...d, [a.nombre]: v !== original }));
                                }}
                              />
                            )}
                          </div>
                          {isDirty && <span className="text-[11px] text-amber-700">Hay cambios sin guardar</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* footer de la tarjeta de ficha */}
                <div className="border-t border-slate-200 p-3 flex items-center justify-between">
                  <span className={MUTED + " text-sm"}>Desplázate para ver todos los campos</span>
                  <button
                    className={btnPrimary}
                    onClick={saveAll}
                    disabled={savingAll || dirtyCount === 0}
                    title={dirtyCount === 0 ? "Sin cambios" : `Hay ${dirtyCount} cambio(s)`}
                  >
                    {savingAll ? "Guardando…" : "Guardar ficha"}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* FOTOS */}
          <section className={card + " " + baseText}>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="font-semibold">Fotos</h3>
              <div className="flex items-center gap-2">
                <label className={btnBase + " cursor-pointer"}>
                  Subir / Cámara
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => setFiles(e.target.files)}
                    title="Abrirá cámara en móvil o galería/archivos"
                  />
                </label>
                <button className={btnBase} onClick={() => setShowCam(true)}>
                  📷 Tomar foto
                </button>
              </div>
            </div>

            {/* Controles de paginación */}
            <div className="flex items-center justify-between mb-2">
              <div className={MUTED + " text-sm"}>
                {fotos.length === 0
                  ? "Sin fotos"
                  : `Mostrando ${photoStart + 1}–${Math.min(photoStart + photoSize, fotos.length)} de ${fotos.length}`}
              </div>
              {fotos.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    className={btnBase}
                    disabled={photoPage <= 1}
                    onClick={() => setPhotoPage((p) => Math.max(1, p - 1))}
                  >
                    ◀
                  </button>
                  <span className="text-sm text-slate-700">
                    Página {photoPage} / {photoTotalPages}
                  </span>
                  <button
                    className={btnBase}
                    disabled={photoPage >= photoTotalPages}
                    onClick={() => setPhotoPage((p) => Math.min(photoTotalPages, p + 1))}
                  >
                    ▶
                  </button>
                  <select
                    className={fieldBase + " w-24"}
                    value={photoSize}
                    onChange={(e) => {
                      setPhotoSize(Number(e.target.value));
                      setPhotoPage(1);
                    }}
                    aria-label="Tamaño de página de fotos"
                  >
                    {[6, 9, 12].map((n) => (
                      <option key={n} value={n}>
                        {n} / pág
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Grilla paginada */}
            {photoSlice.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {photoSlice.map((f, i) => {
                  const checked = selectedPaths.has(f.path);
                  return (
                    <div
                      key={`${f.path}-${i}`}
                      className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-50"
                    >
                      <img src={f.path} alt="" className="w-full h-40 object-cover" />

                      {/* Selección */}
                      <button
                        type="button"
                        className={`absolute top-2 left-2 rounded-lg border px-2 py-1 text-xs backdrop-blur
                          ${checked ? `bg-[${BRAND}] text-slate-800 border-slate-300` : "bg-white/90 text-slate-700 border-slate-200"}`}
                        onClick={() => {
                          setSelectedPaths((prev) => {
                            const next = new Set(prev);
                            if (next.has(f.path)) next.delete(f.path);
                            else next.add(f.path);
                            return next;
                          });
                        }}
                        title={checked ? "Quitar selección" : "Seleccionar"}
                      >
                        {checked ? "✓ Seleccionada" : "Seleccionar"}
                      </button>

                      {/* Borrar individual (abre modal) */}
                      <button
                        type="button"
                        className="absolute top-2 right-2 bg-white/90 hover:bg-white rounded-md px-2 py-1 text-xs border"
                        onClick={() => askDeleteSingle(f.path)}
                        title="Eliminar imagen"
                      >
                        Eliminar
                      </button>

                      <div className="p-2 text-xs text-slate-600 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {f.principal ? <Chip tone="emerald">Principal</Chip> : <Chip>Secundaria</Chip>}
                          {f.orden != null && <span>orden {f.orden}</span>}
                        </div>
                        {f.created_at && (
                          <span className="text-[11px] text-slate-400">{new Date(f.created_at).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pendientes (seleccionadas + capturadas): carrusel horizontal */}
            {(selected.length > 0 || captured.length > 0) && (
              <div className="mb-4">
                <div className="text-sm font-medium mb-2">Pendientes ({selected.length + captured.length})</div>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {selected.map((f, idx) => {
                    const url = URL.createObjectURL(f);
                    return (
                      <div key={`sel-${idx}`} className="relative shrink-0">
                        <img
                          src={url}
                          alt=""
                          className="w-40 h-28 object-cover rounded-lg ring-1 ring-slate-200"
                        />
                        <button
                          type="button"
                          className="absolute top-2 right-2 bg-white/90 rounded-md border px-2 py-0.5 text-xs"
                          onClick={() => {
                            const arr = selected.filter((_, i) => i !== idx);
                            const dt = new DataTransfer();
                            arr.forEach((ff) => dt.items.add(ff));
                            setFiles(dt.files.length ? dt.files : null);
                          }}
                        >
                          Quitar
                        </button>
                      </div>
                    );
                  })}
                  {captured.map((f, idx) => {
                    const url = URL.createObjectURL(f);
                    return (
                      <div key={`cap-${idx}`} className="relative shrink-0">
                        <img
                          src={url}
                          alt=""
                          className="w-40 h-28 object-cover rounded-lg ring-1 ring-slate-200"
                        />
                        <button
                          type="button"
                          className="absolute top-2 right-2 bg-white/90 rounded-md border px-2 py-0.5 text-xs"
                          onClick={() => {
                            setCaptured((arr) => arr.filter((_, i) => i !== idx));
                          }}
                        >
                          Quitar
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Acciones (SOLO subir; el eliminar por selección queda en la barra sticky) */}
            <div className="flex items-center gap-2 flex-wrap">
              <button className={btnPrimary} onClick={uploadPhotos} disabled={uploading || selectedCount === 0}>
                {uploading ? "Subiendo…" : "Subir imágenes"}
              </button>
              <div className={MUTED + " text-xs"}>
                {selectedCount === 0
                  ? "No hay imágenes pendientes."
                  : "Se subirán las seleccionadas/capturadas al presionar el botón."}
              </div>
            </div>

            {/* Barra de acciones sticky cuando hay selección */}
            {selectedPaths.size > 0 && (
              <div className="sticky bottom-0 mt-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 p-3 flex items-center justify-between">
                  <span>
                    {selectedPaths.size} imagen{selectedPaths.size > 1 ? "es" : ""} seleccionada
                    {selectedPaths.size > 1 ? "s" : ""}.
                  </span>
                  <div className="flex gap-2">
                    <button
                      className={btnBase}
                      onClick={() => setSelectedPaths(new Set())}
                      title="Quitar selección"
                    >
                      Limpiar
                    </button>
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-base bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-700 transition"
                      onClick={askDeleteSelected}
                    >
                      Eliminar seleccionadas
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Modal: nuevo campo */}
        {showNewAttr && (
          <NewAttrModal
            refEl={newAttrModalRef}
            closeBtnRef={newAttrCloseBtnRef}
            data={data}
            newAttr={newAttr}
            setNewAttr={setNewAttr}
            onClose={() => setShowNewAttr(false)}
            onCreated={async (createdName) => {
              setShowNewAttr(false);
              setNewAttr({ nombre: "", data_type: "text" });
              await load();
              setOk(`Campo "${createdName}" creado`);
              setToastMsg(`Campo "${createdName}" creado`);
            }}
            onError={(m) => {
              setMsg(m);
              setToastMsg(m);
            }}
          />
        )}

        {/* Modal Confirmación amigable */}
        {showConfirm && (
          <ConfirmModal
            count={confirmTargets.length}
            deleting={deleting}
            onCancel={() => {
              if (!deleting) {
                setShowConfirm(false);
                setConfirmTargets([]);
              }
            }}
            onConfirm={() => deletePhotos(confirmTargets)}
          />
        )}

        {/* Cámara embebida */}
        {showCam && (
          <CamSheet onClose={() => setShowCam(false)} onCapture={(file) => setCaptured((arr) => [...arr, file])} />
        )}

        {/* Toast */}
        <Toast message={toastMsg} onClose={() => setToastMsg(null)} />
      </div>
    </div>
  );
}

/* ===== Modal Nuevo Atributo ===== */
function NewAttrModal({
  refEl,
  closeBtnRef,
  data,
  newAttr,
  setNewAttr,
  onClose,
  onCreated,
  onError,
}: {
  refEl: React.MutableRefObject<HTMLDivElement | null>;
  closeBtnRef: React.MutableRefObject<HTMLButtonElement | null>;
  data: ItemDetail | null;
  newAttr: { nombre: string; data_type: Attr["data_type"] };
  setNewAttr: React.Dispatch<React.SetStateAction<{ nombre: string; data_type: Attr["data_type"] }>>;
  onClose: () => void;
  onCreated: (createdName: string) => void | Promise<void>;
  onError: (msg: string) => void;
}) {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    closeBtnRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, closeBtnRef]);

  function onBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === refEl.current) onClose();
  }

  return (
    <div
      ref={refEl}
      onMouseDown={onBackdropClick}
      className="fixed inset-0 bg-black/10 backdrop-blur-[1px] flex items-center justify-center p-4 z-50"
      aria-modal="true"
      role="dialog"
    >
      <div className={section + " w-full max-w-md"} onMouseDown={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="font-semibold text-base md:text-lg">Nuevo campo para {data?.tipo || "tipo"}</div>
          <button ref={closeBtnRef} className={btnBase} onClick={onClose} aria-label="Cerrar modal">
            Cerrar
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="text-sm text-slate-600 mb-1">Nombre del atributo</div>
            <input
              className={fieldBase}
              value={newAttr.nombre}
              onChange={(e) => setNewAttr({ ...newAttr, nombre: e.target.value })}
              placeholder="p. ej. CAPACIDAD_GB"
            />
          </div>
          <div>
            <div className="text-sm text-slate-600 mb-1">Tipo de dato</div>
            <select
              className={fieldBase}
              value={newAttr.data_type}
              onChange={(e) => setNewAttr({ ...newAttr, data_type: e.target.value as Attr["data_type"] })}
            >
              <option value="text">text</option>
              <option value="int">int</option>
              <option value="numeric">numeric</option>
              <option value="bool">bool</option>
              <option value="date">date</option>
            </select>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button className={btnBase} onClick={onClose}>
            Cancelar
          </button>
          <button
            className={btnPrimary}
            onClick={async () => {
              try {
                const nombre_attr = newAttr.nombre.trim();
                await http.post("/api/spec/attrs", {
                  clase: data?.clase,
                  tipo_nombre: data?.tipo,
                  nombre_attr,
                  data_type: newAttr.data_type,
                });
                await onCreated(nombre_attr);
              } catch (e: any) {
                onError(e?.response?.data?.error || "No se pudo crear el campo");
              }
            }}
          >
            Crear
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== Modal Confirmación (eliminar fotos) ===== */
function ConfirmModal({
  count,
  deleting,
  onCancel,
  onConfirm,
}: {
  count: number;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      ref={ref}
      className="fixed inset-0 bg-black/10 backdrop-blur-[1px] flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === ref.current) onCancel();
      }}
    >
      <div className={section + " w-full max-w-md"} onMouseDown={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-slate-200 font-semibold">
          Eliminar imagen{count > 1 ? "es" : ""}
        </div>
        <div className="p-4">
          <p className="text-slate-700">
            ¿Seguro que deseas eliminar {count} imagen{count > 1 ? "es" : ""}? Esta acción no se puede
            deshacer.
          </p>
        </div>
        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button className={btnBase} onClick={onCancel} disabled={deleting}>
            Cancelar
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-base bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-700 transition disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[112px]"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== Cámara embebida ===== */
function CamSheet({ onClose, onCapture }: { onClose: () => void; onCapture: (f: File) => void }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (!active) return;
        setStream(s);
        if (videoEl) {
          (videoEl as any).srcObject = s;
          videoEl.oncanplay = () => setReady(true);
        }
      } catch {
        onClose();
      }
    })();
    return () => {
      active = false;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
    // sólo depende de videoEl
  }, [videoEl]); // eslint-disable-line react-hooks-exhaustive-deps

  async function capture() {
    if (!videoEl) return;
    const w = videoEl.videoWidth || 1280;
    const h = videoEl.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(videoEl, 0, 0, w, h);
    const blob: Blob = await new Promise((res) =>
      canvas.toBlob((b) => res(b as Blob), "image/jpeg", 0.85)!
    );
    const file = new File([blob], `cam_${Date.now()}.jpg`, { type: "image/jpeg" });
    onCapture(file);
  }

  return (
    <div className="fixed inset-0 bg-black/10 backdrop-blur-[1px] z-50 flex items-center justify-center p-4">
      <div className={section + " w-full max-w-md overflow-hidden"}>
        <div className="px-4 py-3 border-b border-slate-200 font-semibold">Cámara</div>
        <div className="p-3">
          <video
            ref={setVideoEl}
            autoPlay
            playsInline
            muted
            className="w-full rounded-lg bg-black"
            style={{ aspectRatio: "16/9", objectFit: "cover" }}
          />
        </div>
        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
          <button className={btnBase} onClick={onClose}>
            Cerrar
          </button>
          <button className={btnAccent} disabled={!ready} onClick={capture}>
            Tomar foto
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== Toast ===== */
function Toast({ message, onClose }: { message: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 2200);
    return () => clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[60]">
      <div className="rounded-xl shadow-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800">
        {message}
      </div>
    </div>
  );
}
