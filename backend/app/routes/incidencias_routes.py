# app/routes/incidencias_routes.py
from flask import Blueprint, request, jsonify
from app.core.security import require_auth, require_roles
from app.models.incidencia_model import (
    create_incidencia,
    list_incidencias,
    get_incidencia,
    add_mensaje,
    asignar_incidencia,
    set_estado,
    list_updates,
)

bp = Blueprint("incidencias", __name__, url_prefix="/api/incidencias")

# =========================
# Crear incidencia (cualquier autenticado)
# =========================
@bp.post("")
@require_auth
def crear():
    d = request.get_json(force=True) or {}
    titulo = (d.get("titulo") or "").strip()
    descripcion = (d.get("descripcion") or "").strip()
    equipo_id = d.get("equipo_id")
    # Acepta ambos nombres de campo para correo
    email = (d.get("email") or d.get("reportado_email") or "").strip()

    if not titulo or not descripcion:
        return jsonify({"error": "titulo y descripcion requeridos"}), 400

    # Sanitiza equipo_id (None si viene vacío o string no numérico)
    equipo_id_val = None
    if isinstance(equipo_id, int):
        equipo_id_val = equipo_id
    elif isinstance(equipo_id, str) and equipo_id.isdigit():
        equipo_id_val = int(equipo_id)

    inc_id, err = create_incidencia(
        request.claims["username"],
        titulo,
        descripcion,
        equipo_id_val,
        email or None,
    )
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"incidencia_id": inc_id})

# =========================
# Listar incidencias (según rol)
# =========================
@bp.get("")
@require_auth
def listar():
    estado = request.args.get("estado")
    page = request.args.get("page", type=int, default=1)
    size = request.args.get("size", type=int, default=10)
    q = request.args.get("q")
    area_id = request.args.get("area_id", type=int)
    mine = bool(str(request.args.get("mine", "")).lower() in ("1", "true", "yes"))

    data = list_incidencias(
        request.claims["username"],
        mine=mine,
        estado=estado,
        page=page,
        size=size,
        q=q,
        area_id=area_id,
    )
    return jsonify(data)

# =========================
# Detalle de incidencia
# =========================
@bp.get("/<int:incidencia_id>")
@require_auth
def detalle(incidencia_id: int):
    data = get_incidencia(request.claims["username"], incidencia_id)
    if not data:
        return jsonify({"error": "No encontrado"}), 404
    return jsonify(data)

# =========================
# Añadir mensaje (PUBLIC o STAFF)
# =========================
@bp.post("/<int:incidencia_id>/mensajes")
@require_auth
def mensaje(incidencia_id: int):
    d = request.get_json(force=True) or {}
    # Soporta 'mensaje' (frontend) o 'cuerpo' (compatibilidad)
    cuerpo = (d.get("mensaje") or d.get("cuerpo") or "").strip()
    solo_staff = bool(d.get("solo_staff") or False)

    if not cuerpo:
        return jsonify({"error": "mensaje requerido"}), 400

    msg_id, err = add_mensaje(
        request.claims["username"],
        incidencia_id,
        cuerpo,
        solo_staff=solo_staff
    )
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"ok": True, "msg_id": msg_id})

# =========================
# Asignar (solo ADMIN) — pasa a EN_PROCESO en el modelo
# =========================
@bp.patch("/<int:incidencia_id>/asignar")
@require_roles(["ADMIN"])
def asignar(incidencia_id: int):
    d = request.get_json(force=True) or {}
    username = (d.get("username") or "").strip()
    if not username:
        return jsonify({"error": "username requerido"}), 400

    err = asignar_incidencia(request.claims["username"], incidencia_id, username)
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"ok": True})

# =========================
# Cambiar estado (ADMIN o PRACTICANTE)
#   * El modelo impide que PRACTICANTE cierre (CERRADA)
# =========================
@bp.patch("/<int:incidencia_id>")
@require_roles(["ADMIN", "PRACTICANTE"])
def estado(incidencia_id: int):
    d = request.get_json(force=True) or {}
    estado = (d.get("estado") or "").strip()
    if not estado:
        return jsonify({"error": "estado requerido"}), 400

    err = set_estado(request.claims["username"], incidencia_id, estado)
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"ok": True})

# =========================
# Pull incremental de notificaciones (notifier)
# =========================
@bp.get("/updates")
@require_auth
def updates():
    since_id = request.args.get("since_id", type=int)
    data = list_updates(request.claims["username"], since_id)
    return jsonify(data)
