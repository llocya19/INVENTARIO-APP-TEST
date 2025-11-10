# app/models/incidencia_model.py
from typing import Optional, Tuple, Dict, Any, List
from app.db import get_conn
from app.utils.mailer import send_mail_safe

# ========================== Helpers ==========================

def _role_norm(name: Optional[str]) -> str:
    n = (name or "").strip().upper()
    if n in ("USUARIO", "USUARIOS", "USER"):
        return "USUARIO"
    if n in ("PRACTICANTE", "PRACTICANTES"):
        return "PRACTICANTE"
    if n in ("ADMIN", "ADMINISTRADOR"):
        return "ADMIN"
    return n or "USUARIO"

def _get_user_role(cur, username: str) -> str:
    cur.execute("""
      SELECT r.rol_nombre
      FROM inv.usuarios u
      JOIN inv.roles r ON r.rol_id = u.rol_id
      WHERE u.usuario_username = %s
    """, (username,))
    r = cur.fetchone()
    return _role_norm(r[0] if r else None)

def _get_user_email(cur, username: str) -> Optional[str]:
    cur.execute("SELECT usuario_email FROM inv.usuarios WHERE usuario_username=%s", (username,))
    r = cur.fetchone()
    return r[0] if r and r[0] else None

def _get_user_id(cur, username: str) -> Optional[int]:
    cur.execute("SELECT usuario_id FROM inv.usuarios WHERE usuario_username=%s", (username,))
    r = cur.fetchone()
    return int(r[0]) if r else None

def _get_equipo_area(cur, equipo_id: Optional[int]) -> tuple[Optional[str], Optional[int], Optional[str]]:
    if equipo_id is None:
        return None, None, None
    cur.execute("""
        SELECT e.equipo_codigo, e.equipo_area_id, a.area_nombre
        FROM inv.equipos e
        LEFT JOIN inv.areas a ON a.area_id = e.equipo_area_id
        WHERE e.equipo_id = %s
    """, (equipo_id,))
    r = cur.fetchone()
    return (r[0], r[1], r[2]) if r else (None, None, None)

# ============ Crear incidencia (emite NEW_INC para STAFF) ============

def create_incidencia(app_user: str, titulo: str, descripcion: str,
                      equipo_id: Optional[int] = None,
                      reportado_email: Optional[str] = None) -> Tuple[Optional[int], Optional[str]]:
    with get_conn(app_user) as (conn, cur):
        try:
            cur.execute("SELECT set_config('app.proc', %s, true)", ('incidencias.create',))

            equipo_codigo, area_id_equipo, area_nombre_equipo = _get_equipo_area(cur, equipo_id)
            area_id = area_id_equipo

            # fallback: área del usuario si existe esa columna
            cur.execute("""
                SELECT 1 FROM information_schema.columns
                WHERE table_schema='inv' AND table_name='usuarios' AND column_name='usuario_area_id'
            """)
            if area_id is None and cur.fetchone():
                cur.execute("SELECT usuario_area_id FROM inv.usuarios WHERE usuario_username=%s", (app_user,))
                a = cur.fetchone()
                if a and a[0]:
                    area_id = int(a[0])

            cur.execute("""
                INSERT INTO inv.incidencias(equipo_id, area_id, reportado_por, titulo, descripcion, estado)
                VALUES (%s,%s,%s,%s,%s,'ABIERTA')
                RETURNING inc_id
            """, (equipo_id, area_id, app_user, titulo, descripcion))
            inc_id = int(cur.fetchone()[0])

            # Notificación STAFF para admin/practicantes
            cur.execute("""
                INSERT INTO inv.incidencia_mensajes(inc_id, mensaje, usuario, visibilidad, tipo)
                VALUES (%s, %s, %s, 'STAFF', 'NEW_INC')
            """, (inc_id, f"Nueva incidencia creada por {app_user}", 'sistema'))

            cuerpo = [
                f"Incidencia #{inc_id}",
                f"Título: {titulo}",
                f"Descripción:\n{descripcion}",
                "",
                f"Reportado por: {app_user}",
                f"Email: {reportado_email or 'no provisto'}"
            ]
            if equipo_codigo: cuerpo.append(f"Equipo: {equipo_codigo}")
            if area_nombre_equipo: cuerpo.append(f"Área: {area_nombre_equipo}")

            send_mail_safe(
                subject=f"[INCIDENCIA #{inc_id}] {titulo}",
                body="\n".join(cuerpo),
                to=None,
                reply_to=reportado_email or None,
            )
            return inc_id, None
        except Exception as e:
            conn.rollback()
            return None, f"No se pudo crear la incidencia: {e}"

# =================== Listar incidencias ===================

def list_incidencias(app_user: str, mine: bool=False, estado: Optional[str]=None,
                     page: int=1, size: int=10, q: Optional[str]=None,
                     area_id: Optional[int]=None) -> Dict[str, Any]:

    p = max(1, int(page or 1))
    s = min(100, max(1, int(size or 10)))
    off = (p - 1) * s

    with get_conn(app_user) as (conn, cur):
        rol = _get_user_role(cur, app_user)

        sql = """
          SELECT i.inc_id, i.titulo, i.descripcion, i.estado,
                 i.reportado_por, i.equipo_id, e.equipo_codigo,
                 i.area_id, a.area_nombre, i.created_at, i.asignado_a,
                 COUNT(*) OVER() AS total_rows
          FROM inv.incidencias i
          LEFT JOIN inv.equipos e ON e.equipo_id = i.equipo_id
          LEFT JOIN inv.areas  a  ON a.area_id   = i.area_id
          WHERE 1=1
        """
        params: List[Any] = []

        if rol == "USUARIO":
            sql += " AND i.reportado_por = %s"
            params.append(app_user)
        elif rol == "PRACTICANTE":
            sql += " AND i.asignado_a = %s"
            params.append(app_user)
        else:  # ADMIN
            if mine:
                sql += " AND i.reportado_por = %s"
                params.append(app_user)

        if estado:
            sql += " AND i.estado = %s"
            params.append(estado)

        if area_id is not None:
            sql += " AND i.area_id = %s"
            params.append(area_id)

        if q:
            like = f"%{q.lower()}%"
            sql += " AND (LOWER(i.titulo) LIKE %s OR LOWER(i.descripcion) LIKE %s OR LOWER(COALESCE(e.equipo_codigo,'')) LIKE %s)"
            params.extend([like, like, like])

        sql += " ORDER BY i.inc_id DESC LIMIT %s OFFSET %s"
        params.extend([s, off])

        cur.execute(sql, params)
        rows = cur.fetchall()

    items: List[Dict[str, Any]] = []
    total = 0
    for r in rows:
        total = r[11]
        items.append({
            "inc_id": r[0], "titulo": r[1], "descripcion": r[2], "estado": r[3],
            "usuario": r[4], "equipo_id": r[5], "equipo_codigo": r[6],
            "area_id": r[7], "area_nombre": r[8], "created_at": r[9],
            "asignado_a": r[10],
        })
    return {"items": items, "total": int(total or 0), "page": p, "size": s}

# =================== Detalle (oculta STAFF al USUARIO) ===================

def get_incidencia(app_user: str, inc_id: int) -> Optional[Dict[str, Any]]:
    with get_conn(app_user) as (conn, cur):
        cur.execute("""
          SELECT i.inc_id, i.titulo, i.descripcion, i.estado,
                 i.reportado_por, i.equipo_id, e.equipo_codigo,
                 i.area_id, a.area_nombre, i.created_at, i.asignado_a
          FROM inv.incidencias i
          LEFT JOIN inv.equipos e ON e.equipo_id = i.equipo_id
          LEFT JOIN inv.areas  a  ON a.area_id   = i.area_id
          WHERE i.inc_id = %s
        """, (inc_id,))
        h = cur.fetchone()
        if not h:
            return None

        reportado_por = (h[4] or "").lower()
        asignado_a    = (h[10] or "").lower()
        rol           = _role_norm(_get_user_role(cur, app_user))

        if rol == "USUARIO":
            if app_user.lower() != reportado_por:
                return None
            cur.execute("""
              SELECT msg_id, mensaje, usuario, created_at, visibilidad
              FROM inv.incidencia_mensajes
              WHERE inc_id=%s
                AND visibilidad='PUBLIC'
                AND tipo='MSG'
              ORDER BY created_at ASC
            """, (inc_id,))
        elif rol == "PRACTICANTE":
            if app_user.lower() != asignado_a:
                return None
            cur.execute("""
              SELECT msg_id, mensaje, usuario, created_at, visibilidad
              FROM inv.incidencia_mensajes
              WHERE inc_id=%s
              ORDER BY created_at ASC
            """, (inc_id,))
        else:  # ADMIN
            cur.execute("""
              SELECT msg_id, mensaje, usuario, created_at, visibilidad
              FROM inv.incidencia_mensajes
              WHERE inc_id=%s
              ORDER BY created_at ASC
            """, (inc_id,))

        mensajes = [{
            "msg_id": m[0],
            "mensaje": m[1],
            "usuario": m[2],
            "created_at": m[3],
            "solo_staff": (m[4] == "STAFF"),
        } for m in cur.fetchall()]

    return {
        "inc_id": h[0], "titulo": h[1], "descripcion": h[2], "estado": h[3],
        "usuario": h[4], "equipo_id": h[5], "equipo_codigo": h[6],
        "area_id": h[7], "area_nombre": h[8], "created_at": h[9],
        "asignado_a": h[10], "mensajes": mensajes,
    }

# =================== Mensajería ===================

def add_mensaje(app_user: str, inc_id: int, cuerpo: str, solo_staff: bool=False) -> Tuple[Optional[int], Optional[str]]:
    with get_conn(app_user) as (conn, cur):
        try:
            cur.execute("SELECT set_config('app.proc', %s, true)", ('incidencias.add_msg',))
            vis = 'STAFF' if solo_staff else 'PUBLIC'
            cur.execute("""
                INSERT INTO inv.incidencia_mensajes(inc_id, mensaje, usuario, visibilidad, tipo)
                VALUES (%s, %s, %s, %s, 'MSG')
                RETURNING msg_id
            """, (inc_id, cuerpo, app_user, vis))
            return int(cur.fetchone()[0]), None
        except Exception as e:
            conn.rollback()
            return None, f"No se pudo agregar el mensaje: {e}"

def asignar_incidencia(app_user: str, inc_id: int, username: str) -> Optional[str]:
    with get_conn(app_user) as (conn, cur):
        try:
            cur.execute("SELECT set_config('app.proc', %s, true)", ('incidencias.assign',))
            cur.execute("""
                UPDATE inv.incidencias
                SET asignado_a=%s, estado='EN_PROCESO'
                WHERE inc_id=%s
            """, (username, inc_id))
            cur.execute("""
                INSERT INTO inv.incidencia_mensajes(inc_id, mensaje, usuario, visibilidad, tipo)
                VALUES (%s, %s, %s, 'STAFF', 'ASSIGNED')
            """, (inc_id, f"Incidencia asignada a {username}", app_user))
            return None
        except Exception as e:
            conn.rollback()
            return f"No se pudo asignar la incidencia: {e}"

def set_estado(app_user: str, inc_id: int, estado: str) -> Optional[str]:
    estado = (estado or "").strip().upper()
    if estado not in ("ABIERTA", "EN_PROCESO", "CERRADA"):
        return "Estado inválido"
    with get_conn(app_user) as (conn, cur):
        try:
            rol = _get_user_role(cur, app_user)
            if _role_norm(rol) == "PRACTICANTE" and estado == "CERRADA":
                return "Solo ADMIN puede cerrar incidencias"
            cur.execute("UPDATE inv.incidencias SET estado=%s WHERE inc_id=%s", (estado, inc_id))
            return None
        except Exception as e:
            conn.rollback()
            return f"No se pudo actualizar el estado: {e}"

# =================== Feed de notificaciones ===================

def list_updates(app_user: str, since_id: Optional[int]) -> Dict[str, Any]:
    with get_conn(app_user) as (conn, cur):
        rol = _get_user_role(cur, app_user)

        sql = """
          SELECT m.msg_id, m.inc_id, m.mensaje, m.usuario, m.created_at,
                 m.visibilidad, m.tipo, i.titulo, i.estado, i.reportado_por, i.asignado_a
          FROM inv.incidencia_mensajes m
          JOIN inv.incidencias i ON i.inc_id = m.inc_id
          WHERE m.msg_id > %s
            AND LOWER(m.usuario) <> LOWER(%s)
        """
        params = [int(since_id or 0), app_user]

        if rol == "USUARIO":
            sql += " AND i.reportado_por=%s AND m.visibilidad='PUBLIC' AND m.tipo='MSG'"
            params.append(app_user)
        elif rol == "PRACTICANTE":
            sql += " AND i.asignado_a=%s"
            params.append(app_user)
        else:
            pass

        sql += " ORDER BY m.msg_id ASC LIMIT 100"
        cur.execute(sql, params)
        rows = cur.fetchall()

        items, last_id = [], (since_id or 0)
        for r in rows:
            last_id = max(last_id, int(r[0]))
            items.append({
                "msg_id": int(r[0]), "inc_id": int(r[1]), "mensaje": r[2], "usuario": r[3],
                "created_at": r[4], "visibilidad": r[5], "type": r[6],
                "titulo": r[7], "estado": r[8],
            })

        if not rows and (since_id is None or since_id == 0):
            cur.execute("SELECT COALESCE(MAX(msg_id),0) FROM inv.incidencia_mensajes")
            last_id = int(cur.fetchone()[0] or 0)

        return {"items": items, "last_id": last_id}
