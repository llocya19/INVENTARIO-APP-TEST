import { useEffect, useMemo, useRef, useState } from "react";
import http from "../api/http";

/* =========================
   Tipos
========================= */
type User = {
  id: number;
  username: string;
  activo: boolean;
  area_id: number | null;
  rol: "ADMIN" | "USUARIO" | "PRACTICANTE";
  ultimo_login?: string | null;
};

/* =========================
   Tema / helpers UI (Turquesa #80F9FA)
========================= */
const BG_APP = "bg-[#FFFDF8]";
const TEXT = "text-slate-800";
const MUTED = "text-slate-600";

const section = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const baseText = "leading-relaxed tracking-[0.01em]";
const focusRing =
  "focus:outline-none focus:ring-2 focus:ring-[#80F9FA]/50 focus:border-[#80F9FA]/60";
const fieldBase =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] placeholder-slate-400 " +
  TEXT +
  " " +
  focusRing +
  " transition";

function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "subtle" | "danger";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[15px] transition min-h-[40px] font-medium disabled:opacity-50 disabled:cursor-not-allowed";
  const map = {
    primary: "bg-[#80F9FA] text-slate-900 hover:bg-[#6DE2E3] active:bg-[#5FD0D1]",
    secondary: "bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 active:bg-slate-100",
    subtle: "bg-[#80F9FA]/10 border border-[#80F9FA]/30 text-slate-700 hover:bg-[#80F9FA]/20",
    danger: "bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-700",
  };
  return (
    <button className={`${base} ${map[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "turquoise" | "violet" | "amber" | "rose";
}) {
  const map = {
    slate: "bg-slate-100 text-slate-700",
    turquoise: "bg-[#80F9FA]/30 text-[#066B6B]",
    violet: "bg-violet-100 text-violet-700",
    amber: "bg-amber-100 text-amber-800",
    rose: "bg-rose-100 text-rose-700",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] ${map[tone]}`}>{children}</span>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
function SkBar({ w = "w-24" }: { w?: string }) {
  return <div className={`h-3 ${w} rounded bg-slate-200/70 animate-pulse`} />;
}

/* =========================
   Modal Confirmación
========================= */
function ModalConfirm({
  open,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  loading = false,
  tone = "danger",
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  tone?: "danger" | "primary";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className={`${section} relative w-full max-w-md overflow-hidden`}>
        <div className="px-4 py-3 border-b border-slate-200 font-semibold">{title}</div>
        <div className="p-4">
          <p className="text-slate-700">{message}</p>
        </div>
        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Procesando…" : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Página
========================= */
export default function Users() {
  const [items, setItems] = useState<User[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Crear
  const [openCreate, setOpenCreate] = useState(true);
  const [form, setForm] = useState({
    username: "",
    password: "",
    rol: "PRACTICANTE" as User["rol"],
    area_id: "" as string | number,
  });

  // Editar inline (área NO editable)
  const [editId, setEditId] = useState<number | null>(null);
  const [edit, setEdit] = useState<Partial<User> & { password?: string }>({});

  // Confirmación eliminar
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<User | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setMsg(null);
      const params = q ? { params: { q } } : undefined;
      const r = await http.get("/api/users", params);

      const data = Array.isArray(r.data) ? r.data : Array.isArray(r.data?.items) ? r.data.items : [];
      setItems(data as User[]);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo cargar usuarios");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // autocierre de OK
  useEffect(() => {
    if (!ok) return;
    const t = setTimeout(() => setOk(null), 2500);
    return () => clearTimeout(t);
  }, [ok]);

  const filtered = useMemo<User[]>(() => (Array.isArray(items) ? items : []), [items]);

  /* ------------ Crear ------------ */
  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setOk(null);

    const areaParsed =
      form.area_id === "" ? null : isNaN(Number(form.area_id)) ? null : Number(form.area_id);

    if (!form.username.trim() || !form.password || areaParsed === null) {
      setMsg("Completa usuario, contraseña y área (numérica).");
      return;
    }
    try {
      await http.post("/api/users", {
        username: form.username.trim(),
        password: form.password,
        rol: form.rol,
        area_id: areaParsed,
      });
      setOk(`Usuario "${form.username.trim()}" creado correctamente.`);
      setForm({ username: "", password: "", rol: "PRACTICANTE", area_id: "" });
      await load();
      setOpenCreate(false);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "Error al crear el usuario.");
    }
  };

  /* ------------ Editar (sin área) ------------ */
  const startEdit = (u: User) => {
    setEditId(u.id);
    setEdit({ rol: u.rol, activo: u.activo, password: "" });
    setMsg(null);
    setOk(null);
  };
  const cancelEdit = () => {
    setEditId(null);
    setEdit({});
  };

  const saveEdit = async (id: number) => {
    setMsg(null);
    setOk(null);
    const payload: any = {};
    if (edit.rol) payload.rol = edit.rol;
    if (typeof edit.activo === "boolean") payload.activo = edit.activo;
    if (edit.password) payload.password = edit.password;

    try {
      await http.patch(`/api/users/${id}`, payload);
      const changedPwd = Boolean(edit.password);
      setOk(
        changedPwd
          ? "Usuario actualizado. La contraseña fue cambiada correctamente."
          : "Usuario actualizado correctamente."
      );
      cancelEdit();
      await load();
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "Error al actualizar el usuario.");
    }
  };

  /* ------------ Acciones rápidas ------------ */
  const toggleActivo = async (u: User) => {
    try {
      await http.patch(`/api/users/${u.id}`, { activo: !u.activo });
      setOk(!u.activo ? `Usuario "${u.username}" activado.` : `Usuario "${u.username}" desactivado.`);
      await load();
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo cambiar el estado del usuario.");
    }
  };

  const askDelete = (u: User) => {
    setConfirmTarget(u);
    setConfirmOpen(true);
  };

  const doDelete = async () => {
    if (!confirmTarget) return;
    setConfirmBusy(true);
    setMsg(null);
    setOk(null);
    try {
      await http.delete(`/api/users/${confirmTarget.id}`);
      setOk(`Usuario "${confirmTarget.username}" eliminado correctamente.`);
      setConfirmOpen(false);
      setConfirmTarget(null);
      await load();
    } catch (e: any) {
      setMsg(e?.response?.data?.error || "No se pudo eliminar el usuario.");
    } finally {
      setConfirmBusy(false);
    }
  };

  const badgeRol = (rol: User["rol"]) => {
    if (rol === "ADMIN") return <Badge tone="rose">ADMIN</Badge>;
    if (rol === "USUARIO") return <Badge tone="turquoise">USUARIO</Badge>;
    return <Badge tone="amber">PRACTICANTE</Badge>;
  };

  const badgeEstado = (a: boolean) =>
    a ? <Badge tone="turquoise">Activo</Badge> : <Badge tone="slate">Inactivo</Badge>;

  /* =========================
     Render
  ========================= */
  return (
    <div className={`${BG_APP} ${TEXT} min-h-[calc(100vh-64px)]`}>
      <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 py-5 space-y-5">
        {/* Header + acciones */}
        <div className={`${section} px-4 py-4 md:px-6 md:py-5 ${baseText}`}>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h1 className="text-[22px] md:text-[26px] font-semibold">Usuarios</h1>
              <p className={MUTED + " text-sm"}>Administra cuentas, roles, estado y credenciales.</p>
            </div>

            {/* Toolbar búsqueda */}
            <div className="flex w-full sm:w-auto items-center gap-2">
              <div className="relative flex-1 sm:w-72">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M10 4a6 6 0 014.472 9.994l4.267 4.267-1.414 1.414-4.267-4.267A6 6 0 1110 4zm0 2a4 4 0 100 8 4 4 0 000-8z" />
                  </svg>
                </span>
                <input
                  ref={searchInputRef}
                  className={fieldBase + " pl-10"}
                  placeholder="Buscar por usuario..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") load();
                    if (e.key === "Escape") {
                      setQ("");
                      setTimeout(() => searchInputRef.current?.blur(), 0);
                    }
                  }}
                  autoComplete="username"
                />
              </div>
              <Button variant="secondary" onClick={load} disabled={loading}>
                {loading ? (
                  <>
                    <Spinner /> Buscando…
                  </>
                ) : (
                  "Buscar"
                )}
              </Button>
              <Button
                variant="subtle"
                onClick={() => {
                  setQ("");
                  load();
                }}
                disabled={loading}
              >
                Limpiar
              </Button>
            </div>
          </div>
        </div>

        {/* feedback */}
        {msg && <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800">{msg}</div>}
        {ok && (
          <div className="p-3 rounded-xl border border-[#80F9FA]/30 bg-[#80F9FA]/10 text-[#066B6B]">
            {ok}
          </div>
        )}

        {/* Crear usuario (card plegable) */}
        <div className={section}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <div className="font-medium">Crear usuario</div>
            <button
              className={"text-sm " + (openCreate ? "text-slate-700" : "text-slate-600 hover:text-slate-900")}
              onClick={() => setOpenCreate((v) => !v)}
            >
              {openCreate ? "Ocultar" : "Mostrar"}
            </button>
          </div>
          {openCreate && (
            <form onSubmit={onCreate} className="p-4 md:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <div className={MUTED + " text-sm mb-1"}>Usuario</div>
                  <input
                    className={fieldBase}
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="ej. jdoe"
                    autoComplete="username"
                  />
                </div>
                <div>
                  <div className={MUTED + " text-sm mb-1"}>Contraseña</div>
                  <input
                    type="password"
                    className={fieldBase}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <div className={MUTED + " text-sm mb-1"}>Rol</div>
                  <select
                    className={fieldBase}
                    value={form.rol}
                    onChange={(e) => setForm({ ...form, rol: e.target.value as User["rol"] })}
                  >
                    <option value="PRACTICANTE">PRACTICANTE</option>
                    <option value="USUARIO">USUARIO</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
                <div>
                  <div className={MUTED + " text-sm mb-1"}>Área ID</div>
                  <input
                    type="number"
                    className={fieldBase}
                    value={form.area_id}
                    onChange={(e) => setForm({ ...form, area_id: e.target.value })}
                    placeholder="p. ej. 1"
                    min={0}
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button type="submit">Crear usuario</Button>
              </div>
            </form>
          )}
        </div>

        {/* ====== Lista responsive ====== */}
        {/* Móvil: tarjetas */}
        <div className={`${section} md:hidden`}>
          <div className="divide-y">
            {loading && filtered.length === 0 && (
              <>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={`sk-m-${i}`} className="p-4 space-y-2">
                    <SkBar w="w-20" />
                    <SkBar w="w-40" />
                    <SkBar w="w-32" />
                  </div>
                ))}
              </>
            )}
            {!loading && filtered.length === 0 && (
              <div className="p-6 text-center text-slate-500">Sin resultados</div>
            )}
            {filtered.map((u) => {
              const isEditing = editId === u.id;
              return (
                <div key={`m-${u.id}`} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-slate-500">Usuario</div>
                      <div className="text-base font-semibold break-all">{u.username}</div>
                      <div className="mt-2 flex items-center gap-2">
                        {badgeRol(isEditing ? (edit.rol ?? u.rol) : u.rol)}
                        {badgeEstado(isEditing ? Boolean(edit.activo ?? u.activo) : u.activo)}
                      </div>
                    </div>
                    <div className="text-right text-sm text-slate-500">
                      <div>ID #{u.id}</div>
                      <div>Área {u.area_id ?? "—"}</div>
                      <div className="mt-1">
                        {u.ultimo_login ? new Date(u.ultimo_login).toLocaleString() : "-"}
                      </div>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <select
                        className={fieldBase}
                        value={edit.rol ?? u.rol}
                        onChange={(e) => setEdit({ ...edit, rol: e.target.value as User["rol"] })}
                      >
                        <option value="PRACTICANTE">PRACTICANTE</option>
                        <option value="USUARIO">USUARIO</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                      <select
                        className={fieldBase}
                        value={String(edit.activo ?? u.activo)}
                        onChange={(e) => setEdit({ ...edit, activo: e.target.value === "true" })}
                      >
                        <option value="true">Activo</option>
                        <option value="false">Inactivo</option>
                      </select>
                      <input
                        type="password"
                        className={fieldBase}
                        placeholder="Nueva clave (opcional)"
                        value={edit.password ?? ""}
                        onChange={(e) => setEdit({ ...edit, password: e.target.value })}
                        autoComplete="new-password"
                      />
                      <div className="sm:col-span-2 flex flex-wrap gap-2 justify-end">
                        <Button onClick={() => saveEdit(u.id)}>Guardar</Button>
                        <Button variant="secondary" onClick={cancelEdit}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => startEdit(u)}>
                        Editar
                      </Button>
                      <Button variant="secondary" onClick={() => toggleActivo(u)}>
                        {u.activo ? "Desactivar" : "Activar"}
                      </Button>
                      <Button variant="danger" onClick={() => askDelete(u)}>
                        Eliminar
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Desktop: tabla */}
        <div className={`${section} relative overflow-hidden hidden md:block`}>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-[14px] table-auto">
              <thead className="sticky top-0 z-10 bg-[#80F9FA]/10 border-b">
                <tr className="text-left text-slate-700">
                  <th className="py-2.5 px-3">ID</th>
                  <th className="py-2.5 px-3">Usuario</th>
                  <th className="py-2.5 px-3">Rol</th>
                  <th className="py-2.5 px-3">Área</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3">Último login</th>
                  <th className="py-2.5 px-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {loading && filtered.length === 0 && (
                  <>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <tr key={`skeleton-${i}`} className="border-b">
                        <td className="py-2.5 px-3"><SkBar w="w-10" /></td>
                        <td className="py-2.5 px-3"><SkBar w="w-32" /></td>
                        <td className="py-2.5 px-3"><SkBar w="w-20" /></td>
                        <td className="py-2.5 px-3"><SkBar w="w-12" /></td>
                        <td className="py-2.5 px-3"><SkBar w="w-16" /></td>
                        <td className="py-2.5 px-3"><SkBar w="w-24" /></td>
                        <td className="py-2.5 px-3"><SkBar w="w-48" /></td>
                      </tr>
                    ))}
                  </>
                )}

                {filtered.map((u) => (
                  <tr key={u.id} className="border-b last:border-b-0 hover:bg-[#80F9FA]/5">
                    <td className="py-2.5 px-3 whitespace-nowrap">{u.id}</td>

                    <td className="py-2.5 px-3 break-all">
                      <div className="font-medium text-slate-800">{u.username}</div>
                    </td>

                    <td className="py-2.5 px-3">
                      {editId === u.id ? (
                        <div className="min-w-[200px] max-w-xs">
                          <select
                            className={fieldBase + " w-full"}
                            value={edit.rol ?? u.rol}
                            onChange={(e) => setEdit({ ...edit, rol: e.target.value as User["rol"] })}
                          >
                            <option value="PRACTICANTE">PRACTICANTE</option>
                            <option value="USUARIO">USUARIO</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                        </div>
                      ) : (
                        badgeRol(u.rol)
                      )}
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-medium text-slate-700">{u.area_id ?? "—"}</span>
                    </td>

                    <td className="py-2.5 px-3">
                      {editId === u.id ? (
                        <div className="min-w-[140px] max-w-xs">
                          <select
                            className={fieldBase + " w-full"}
                            value={String(edit.activo ?? u.activo)}
                            onChange={(e) => setEdit({ ...edit, activo: e.target.value === "true" })}
                          >
                            <option value="true">Activo</option>
                            <option value="false">Inactivo</option>
                          </select>
                        </div>
                      ) : (
                        badgeEstado(u.activo)
                      )}
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {u.ultimo_login ? new Date(u.ultimo_login).toLocaleString() : "-"}
                    </td>

                    <td className="py-2.5 px-3">
                      {editId === u.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="password"
                            placeholder="Nueva clave (opcional)"
                            className={fieldBase + " w-56"}
                            value={edit.password ?? ""}
                            onChange={(e) => setEdit({ ...edit, password: e.target.value })}
                            autoComplete="new-password"
                          />
                          <Button onClick={() => saveEdit(u.id)}>Guardar</Button>
                          <Button variant="secondary" onClick={cancelEdit}>
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button variant="secondary" onClick={() => startEdit(u)} title="Editar rol/estado">
                            Editar
                          </Button>
                          <Button variant="secondary" onClick={() => toggleActivo(u)}>
                            {u.activo ? "Desactivar" : "Activar"}
                          </Button>
                          <Button variant="danger" onClick={() => askDelete(u)} title="Eliminar usuario">
                            Eliminar
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}

                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Sin resultados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {/* ====== /Lista responsive ====== */}
      </div>

      {/* Modal Confirmación eliminar */}
      <ModalConfirm
        open={confirmOpen}
        title="Eliminar usuario"
        message={
          confirmTarget
            ? `¿Deseas eliminar al usuario "${confirmTarget.username}"? Esta acción no se puede deshacer.`
            : ""
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        loading={confirmBusy}
        tone="danger"
        onCancel={() => {
          if (!confirmBusy) {
            setConfirmOpen(false);
            setConfirmTarget(null);
          }
        }}
        onConfirm={doDelete}
      />
    </div>
  );
}
