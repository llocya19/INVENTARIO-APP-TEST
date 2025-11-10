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

# Crear incidencia (cualquier autenticado)
@bp.post("")
@require_auth
def crear():
    d = request.get_json(force=True) or {}
    titulo = (d.get("titulo") or "").strip()
    descripcion = (d.get("descripcion") or "").strip()
    equipo_id = d.get("equipo_id")
    email = (d.get("email") or d.get("reportado_email") or "").strip()

    if not titulo or not descripcion:
        return {"error": "titulo y descripcion requeridos"}, 400

    inc_id, err = create_incidencia(
        request.claims["username"],
        titulo,
        descripcion,
        int(equipo_id) if (isinstance(equipo_id, int) or (isinstance(equipo_id, str) and equipo_id.isdigit())) else None,
        email or None,
    )
    if err:
        return {"error": err}, 400
    return {"incidencia_id": inc_id}

# Listar incidencias
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

# Detalle
@bp.get("/<int:incidencia_id>")
@require_auth
def detalle(incidencia_id: int):
    data = get_incidencia(request.claims["username"], incidencia_id)
    if not data:
        return {"error": "No encontrado"}, 404
    return jsonify(data)

# Añadir mensaje
@bp.post("/<int:incidencia_id>/mensajes")
@require_auth
def mensaje(incidencia_id: int):
    d = request.get_json(force=True) or {}
    cuerpo = (d.get("cuerpo") or "").strip()
    solo_staff = bool(d.get("solo_staff") or False)
    if not cuerpo:
        return {"error": "cuerpo requerido"}, 400

    msg_id, err = add_mensaje(request.claims["username"], incidencia_id, cuerpo, solo_staff=solo_staff)
    if err:
        return {"error": err}, 400
    return {"ok": True, "msg_id": msg_id}

# Asignar (solo ADMIN)
@bp.patch("/<int:incidencia_id>/asignar")
@require_roles(["ADMIN"])
def asignar(incidencia_id: int):
    d = request.get_json(force=True) or {}
    username = (d.get("username") or "").strip()
    if not username:
        return {"error": "username requerido"}, 400

    err = asignar_incidencia(request.claims["username"], incidencia_id, username)
    if err:
        return {"error": err}, 400
    return {"ok": True}

# Cambiar estado (ADMIN o PRACTICANTE)
@bp.patch("/<int:incidencia_id>")
@require_roles(["ADMIN", "PRACTICANTE"])
def estado(incidencia_id: int):
    d = request.get_json(force=True) or {}
    estado = (d.get("estado") or "").strip()
    err = set_estado(request.claims["username"], incidencia_id, estado)
    if err:
        return {"error": err}, 400
    return {"ok": True}

# Pull incremental de notificaciones
@bp.get("/updates")
@require_auth
def updates():
    since_id = request.args.get("since_id", type=int)
    data = list_updates(request.claims["username"], since_id)
    return jsonify(data)
