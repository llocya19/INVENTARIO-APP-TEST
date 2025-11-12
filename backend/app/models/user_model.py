from typing import Optional, Tuple, List, Dict
from app.db import get_conn

# ============================================================
# Utilidades de mapeo de roles (UI <-> BD)
# BD: ADMIN | USUARIO | PRACTICANTE
# UI: ADMIN | USUARIO | PRACTICANTE
# ============================================================

def _normalize_role(name: str) -> str:
    """Normaliza el literal de rol (mayúsculas, sin espacios)."""
    return (name or "").strip().upper()

def _ui_to_db_role(rol_ui: str) -> str:
    """
    Dado un rol de la UI, devuelve el valor EXACTO usado en BD.
    (Se eliminó el plural 'USUARIOS' para evitar romper el CHECK de BD).
    """
    r = _normalize_role(rol_ui)
    # Aceptamos solo los tres valores válidos
    if r in ("ADMIN", "USUARIO", "PRACTICANTE"):
        return r
    # Si llegara otro string, lo devolvemos normalizado (para que falle
    # correctamente aguas abajo y no inserte valores fuera del CHECK).
    return r

def _db_to_ui_role(rol_db: str) -> str:
    """
    En este proyecto UI y BD usan exactamente los mismos literales.
    (Antes se convertía USUARIOS -> USUARIO; ya no aplica).
    """
    return _normalize_role(rol_db)

def _role_id(cur, rol_nombre_ui: str) -> Optional[int]:
    """Obtiene el rol_id a partir del nombre de rol de la UI."""
    rol_db = _ui_to_db_role(rol_nombre_ui)
    cur.execute("SELECT rol_id FROM inv.roles WHERE rol_nombre = %s", (rol_db,))
    row = cur.fetchone()
    return int(row[0]) if row else None


# ============================================================
# Autenticación (LOGIN)
# ============================================================

def login_and_check(username: str, password: str):
    """
    Valida credenciales y retorna dict con:
      { id, username, area_id, rol }  |  (None, 'mensaje de error')
    """
    with get_conn(username) as (conn, cur):
        cur.execute("""
          SELECT u.usuario_id, u.usuario_username, u.usuario_area_id, r.rol_nombre,
                 COALESCE(u.usuario_activo, true) AS activo,
                 u.usuario_password_bcrypt
          FROM inv.usuarios u
          JOIN inv.roles r ON r.rol_id = u.rol_id
          WHERE u.usuario_username = %s
        """, (username,))
        row = cur.fetchone()
        if not row:
            return None, "Usuario no existe"

        user_id, uname, area_id, rol_db, activo, hashpwd = row

        # Verifica password usando crypt de PostgreSQL
        cur.execute("SELECT %s = crypt(%s, %s)", (hashpwd, password, hashpwd))
        ok_pwd = cur.fetchone()[0]
        if not ok_pwd:
            return None, "Contraseña incorrecta"
        if not activo:
            return None, "Usuario desactivado"

        rol_ui = _db_to_ui_role(rol_db)
        # Actualiza último login (no es crítico si falla)
        cur.execute("UPDATE inv.usuarios SET usuario_ultimo_login = now() WHERE usuario_id=%s", (user_id,))

    return {"id": user_id, "username": uname, "area_id": area_id, "rol": rol_ui}, None


# ============================================================
# CRUD de usuarios
# ============================================================

def list_users(app_user: str, q: Optional[str] = None, rol_ui: Optional[str] = None) -> List[Dict]:
    """
    Lista usuarios con filtros opcionales por texto (q) y rol.
    Retorna arreglo de dicts con {id, username, activo, area_id, rol, ultimo_login}.
    """
    where = []
    params: List = []
    if q:
        where.append("(u.usuario_username ILIKE %s)")
        params.append(f"%{q}%")
    if rol_ui:
        where.append("r.rol_nombre = %s")
        params.append(_ui_to_db_role(rol_ui))

    SQL = f"""
    SELECT u.usuario_id, u.usuario_username, u.usuario_activo, u.usuario_area_id,
           r.rol_nombre, u.usuario_ultimo_login
    FROM inv.usuarios u
    JOIN inv.roles r ON r.rol_id=u.rol_id
    {"WHERE " + " AND ".join(where) if where else ""}
    ORDER BY u.usuario_id DESC
    """
    with get_conn(app_user) as (conn, cur):
        cur.execute(SQL, params)
        rows = cur.fetchall()
    return [{
        "id": r[0],
        "username": r[1],
        "activo": r[2],
        "area_id": r[3],
        "rol": _db_to_ui_role(r[4]),
        "ultimo_login": r[5]
    } for r in rows]

def get_user_by_id(app_user: str, user_id: int) -> Optional[dict]:
    """Obtiene un usuario por ID."""
    SQL = """
    SELECT u.usuario_id, u.usuario_username, u.usuario_activo, u.usuario_area_id,
           r.rol_nombre, u.usuario_ultimo_login
    FROM inv.usuarios u
    JOIN inv.roles r ON r.rol_id=u.rol_id
    WHERE u.usuario_id=%s
    """
    with get_conn(app_user) as (conn, cur):
        cur.execute(SQL, (user_id,))
        r = cur.fetchone()
    if not r:
        return None
    return {
        "id": r[0],
        "username": r[1],
        "activo": r[2],
        "area_id": r[3],
        "rol": _db_to_ui_role(r[4]),
        "ultimo_login": r[5]
    }

def create_user(app_user: str, username: str, password: str, rol_ui: str, area_id: int) -> Tuple[Optional[int], Optional[str]]:
    """
    Crea un usuario con rol y área. Retorna (id, None) en éxito o (None, error) en fallo.
    """
    with get_conn(app_user) as (conn, cur):
        rid = _role_id(cur, rol_ui)
        if not rid:
            return None, "Rol inexistente"
        try:
            cur.execute("""
              INSERT INTO inv.usuarios(usuario_username, usuario_password_bcrypt, rol_id, usuario_area_id, usuario_activo)
              VALUES (%s, crypt(%s, gen_salt('bf')), %s, %s, true)
              RETURNING usuario_id
            """, (username, password, rid, area_id))
            new_id = cur.fetchone()[0]
            return int(new_id), None
        except Exception as e:
            return None, f"No se pudo crear usuario: {e}"

def update_user(app_user: str, user_id: int, data: dict) -> Optional[str]:
    """
    Actualiza campos del usuario. data puede contener:
      password, rol, area_id, activo
    """
    sets, params = [], []

    if "password" in data and data["password"]:
        sets.append("usuario_password_bcrypt = crypt(%s, gen_salt('bf'))")
        params.append(data["password"])

    if "rol" in data and data["rol"]:
        rol_ui = _normalize_role(str(data["rol"]))
        with get_conn(app_user) as (conn, cur):
            rid = _role_id(cur, rol_ui)
        if not rid:
            return "Rol inválido"
        sets.append("rol_id = %s")
        params.append(rid)

    if "area_id" in data and data["area_id"] is not None:
        sets.append("usuario_area_id = %s")
        params.append(int(data["area_id"]))

    if "activo" in data:
        sets.append("usuario_activo = %s")
        params.append(bool(data["activo"]))

    if not sets:
        return None

    params.append(user_id)
    SQL = "UPDATE inv.usuarios SET " + ", ".join(sets) + " WHERE usuario_id=%s"

    with get_conn(app_user) as (conn, cur):
        try:
            cur.execute(SQL, params)
        except Exception as e:
            return f"No se pudo actualizar: {e}"
    return None

def delete_user(app_user: str, user_id: int) -> Optional[str]:
    """Elimina un usuario por ID."""
    with get_conn(app_user) as (conn, cur):
        try:
            cur.execute("DELETE FROM inv.usuarios WHERE usuario_id=%s", (user_id,))
        except Exception as e:
            return f"No se pudo eliminar: {e}"
    return None


# ============================================================
# Auto-usuario de equipos (ROL BD = USUARIO)
# ============================================================

def ensure_user_for_equipo(app_user: str,
                           username: Optional[str],
                           raw_password: Optional[str],
                           area_id: Optional[int]) -> None:
    """
    Crea/actualiza automáticamente un usuario para el equipo (si 'username' no es vacío).
    - Asegura que exista el rol 'USUARIO' (singular).
    - Si el usuario existe, actualiza rol, password (si se envía) y área.
    - Si no existe, lo crea con ese rol y área.
    NOTA: En tu BD 'usuario_area_id' es NOT NULL, así que 'area_id' debería venir válido.
    """
    uname = (username or "").strip()
    if not uname:
        return  # nada que hacer si no hay login

    with get_conn(app_user) as (conn, cur):
        # === 1) Asegurar rol 'USUARIO' (singular) ===
        cur.execute("SELECT rol_id FROM inv.roles WHERE upper(rol_nombre) = 'USUARIO'")
        r = cur.fetchone()
        if not r:
            # Si no existe, lo creamos. Pasa el CHECK (ADMIN/USUARIO/PRACTICANTE).
            cur.execute("INSERT INTO inv.roles(rol_nombre) VALUES ('USUARIO') RETURNING rol_id")
            rid = int(cur.fetchone()[0])
        else:
            rid = int(r[0])

        # === 2) ¿Ya existe el usuario? ===
        cur.execute("SELECT usuario_id FROM inv.usuarios WHERE usuario_username = %s", (uname,))
        row = cur.fetchone()

        if row:
            # Actualiza: rol (forzamos USUARIO), password si viene, y área si viene.
            uid = int(row[0])
            sets = ["rol_id=%s"]
            params: List = [rid]

            if raw_password:
                sets.append("usuario_password_bcrypt = crypt(%s, gen_salt('bf'))")
                params.append(raw_password)

            if area_id is not None:
                sets.append("usuario_area_id = %s")
                params.append(int(area_id))

            params.append(uid)
            cur.execute(f"UPDATE inv.usuarios SET {', '.join(sets)} WHERE usuario_id=%s", params)
        else:
            # Crea el usuario; si no se pasó password, usa el propio username como valor inicial.
            cur.execute("""
              INSERT INTO inv.usuarios(
                usuario_username, usuario_password_bcrypt, rol_id, usuario_area_id, usuario_activo
              ) VALUES (%s, crypt(%s, gen_salt('bf')), %s, %s, true)
            """, (uname, raw_password or uname, rid, int(area_id) if area_id is not None else None))
