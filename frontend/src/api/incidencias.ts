// frontend/src/api/incidencias.ts
import http from "./http";

export type Incidencia = {
  inc_id: number;
  titulo: string;
  descripcion: string;
  estado: "ABIERTA" | "EN_PROCESO" | "CERRADA";
  equipo_id?: number | null;
  equipo_codigo?: string | null;
  area_id?: number | null;
  area_nombre?: string | null;
  created_at?: string;
};

/* =========================
 * LISTADOS
 * ========================= */
export async function listarIncidencias(params: {
  estado?: string;
  area_id?: number;
  q?: string;
  page?: number;
  size?: number;
  mine?: boolean; // cuando es true, trae solo del usuario autenticado
}) {
  const { data } = await http.get("/api/incidencias", { params });
  return data as { items: Incidencia[]; total: number; page: number; size: number };
}

/** Opción A: wrapper para no tocar tus páginas */
export async function listarMisIncidencias(params: { page?: number; size?: number }) {
  // reutiliza el mismo endpoint forzando mine=true
  return listarIncidencias({ ...params, mine: true });
}

/* =========================
 * CRUD BÁSICO
 * ========================= */
export async function crearIncidencia(payload: {
  titulo: string;
  descripcion: string;
  equipo_id?: number;
  email?: string;
}) {
  const { data } = await http.post("/api/incidencias", payload);
  return data as { incidencia_id: number };
}

export async function obtenerIncidencia(id: number) {
  const { data } = await http.get(`/api/incidencias/${id}`);
  // El detalle puede seguir devolviendo solo_staff (compat)
  return data as Incidencia & {
    mensajes: {
      msg_id?: number;
      mensaje: string;
      usuario: string;
      created_at: string;
      solo_staff?: boolean; // backend puede seguir enviándolo en el detalle
    }[];
    asignado_a?: string | null;
  };
}

export async function agregarMensaje(
  inc_id: number,
  cuerpo: string,
  opts?: { solo_staff?: boolean }
) {
  const { data } = await http.post(`/api/incidencias/${inc_id}/mensajes`, {
    cuerpo,
    solo_staff: Boolean(opts?.solo_staff),
  });
  return data as { ok: true; msg_id: number };
}

export async function asignarPracticante(inc_id: number, username: string) {
  const { data } = await http.patch(`/api/incidencias/${inc_id}/asignar`, { username });
  return data as { ok: true };
}

export async function cambiarEstado(inc_id: number, estado: Incidencia["estado"]) {
  const { data } = await http.patch(`/api/incidencias/${inc_id}`, { estado });
  return data as { ok: true };
}

/* =========================
 * NOTIFICACIONES (polling)
 * ========================= */
export type UpdateItem = {
  msg_id: number;
  inc_id: number;
  mensaje: string;
  usuario: string;
  created_at: string;
  visibilidad: "PUBLIC" | "STAFF"; // <- usado por IncidenciaNotifier
  titulo: string;
  estado: string;
  type: "MSG" | "NEW_INC" | "ASSIGNED"; // <- usado por IncidenciaNotifier
};

export async function fetchUpdates(since_id?: number) {
  const { data } = await http.get("/api/incidencias/updates", { params: { since_id } });
  return data as {
    items: UpdateItem[];
    last_id: number;
  };
}

/* =========================
 * ACCIONES MASIVAS (opcional)
 * ========================= */
export async function bulkAsignar(inc_ids: number[], username: string) {
  const { data } = await http.post("/api/incidencias/bulk-asignar", { inc_ids, username });
  return data as {
    ok?: boolean;
    error?: string;
    done: number[];
    skipped: { inc_id: number; reason: string }[];
  };
}

export async function bulkEstado(inc_ids: number[], estado: Incidencia["estado"]) {
  const { data } = await http.post("/api/incidencias/bulk-estado", { inc_ids, estado });
  return data as {
    ok?: boolean;
    error?: string;
    done: number[];
    skipped: { inc_id: number; reason: string }[];
  };
}
