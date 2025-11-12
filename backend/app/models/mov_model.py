# app/models/mov_model.py
from typing import Optional, Any, Dict, List, Tuple
from app.db import get_conn


def _where_and_params_mov(
    tipo: Optional[str],
    desde: Optional[str],
    hasta: Optional[str],
    q: Optional[str],
    item_id: Optional[int],
    equipo_id: Optional[int],
    area_id: Optional[int],
) -> Tuple[str, List[Any]]:
    """
    Construye WHERE y params para inv.movimientos (fuente MOV),
    mapeando correctamente:
      - PRESTAMO: TRASLADO con detalle.es_prestamo = true
      - RETORNO : TRASLADO con detalle.devolucion = true
      - USO/ALMACEN/MANTENIMIENTO/BAJA: también acepta EQUIPO_ESTADO(after = tipo)
    Nota: REPARACION no se filtra aquí (se trata como caso especial).
    """
    sql = ""
    params: List[Any] = []

    # Fechas / ids
    if desde:
        sql += " AND m.mov_fecha::date >= %s::date"; params.append(desde)
    if hasta:
        sql += " AND m.mov_fecha::date <= %s::date"; params.append(hasta)
    if item_id:
        sql += " AND m.mov_item_id = %s"; params.append(int(item_id))
    if equipo_id:
        sql += " AND m.mov_equipo_id = %s"; params.append(int(equipo_id))
    if area_id:
        sql += " AND (m.mov_origen_area_id = %s OR m.mov_destino_area_id = %s)"
        params.extend([int(area_id), int(area_id)])

    # Tipo “inteligente”
    if tipo:
        t = (tipo or "").upper()

        # Préstamo / Retorno: TRASLADO con flags en detalle
        if t == "PRESTAMO":
            sql += " AND m.mov_tipo='TRASLADO' AND COALESCE((m.mov_detalle->>'es_prestamo')::boolean,false)=true"
        elif t == "RETORNO":
            sql += " AND m.mov_tipo='TRASLADO' AND COALESCE((m.mov_detalle->>'devolucion')::boolean,false)=true"

        # Estados de equipo: aceptar registros EQUIPO_ESTADO(after=t) además del literal
        elif t in ("USO", "ALMACEN", "MANTENIMIENTO", "BAJA"):
            sql += " AND ( (m.mov_tipo=%s) OR (m.mov_tipo='EQUIPO_ESTADO' AND (m.mov_detalle->>'after')=%s) )"
            params.extend([t, t])

        # Cualquier otro (excepto REPARACION, que es especial)
        elif t != "REPARACION":
            sql += " AND m.mov_tipo = %s"
            params.append(t)

    # Búsqueda libre
    if q:
        like = f"%{q}%"
        sql += """
          AND (
                i.item_codigo ILIKE %s
            OR  it.nombre ILIKE %s
            OR  COALESCE(e.equipo_codigo,'') ILIKE %s
            OR  COALESCE(e.equipo_nombre,'') ILIKE %s
            OR  COALESCE(m.mov_usuario_app,'') ILIKE %s
            OR  COALESCE(m.mov_motivo,'') ILIKE %s
            OR  m.mov_detalle::text ILIKE %s
          )
        """
        params.extend([like, like, like, like, like, like, like])

    return sql, params


def _where_and_params_audit(
    desde: Optional[str],
    hasta: Optional[str],
    q: Optional[str],
) -> Tuple[str, List[Any]]:
    sql = ""
    params: List[Any] = []

    if desde:
        sql += " AND a.created_at::date >= %s::date"
        params.append(desde)

    if hasta:
        sql += " AND a.created_at::date <= %s::date"
        params.append(hasta)

    if q:
        like = f"%{q}%"
        # Cast de entidad_id a texto para evitar problemas con ILIKE
        sql += """
          AND (
               a.actor_user ILIKE %s
            OR a.accion ILIKE %s
            OR a.entidad ILIKE %s
            OR COALESCE(a.entidad_id::text,'') ILIKE %s
            OR COALESCE(a.extra::text,'') ILIKE %s
            OR COALESCE(a.antes::text,'') ILIKE %s
            OR COALESCE(a.despues::text,'') ILIKE %s
          )
        """
        params.extend([like, like, like, like, like, like, like])

    return sql, params


def list_auditoria_flexible(
    app_user: str,
    fuente: str = "MOV",            # "MOV" | "AUDIT" | "MIX"
    page: int = 1,
    size: int = 20,
    tipo: Optional[str] = None,     # solo se aplica a MOV
    desde: Optional[str] = None,
    hasta: Optional[str] = None,
    q: Optional[str] = None,
    item_id: Optional[int] = None,
    equipo_id: Optional[int] = None,
    area_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Devuelve registros de:
    - inv.movimientos (cuando fuente=MOV)
    - inv.audit_log   (cuando fuente=AUDIT)
    - UNION ALL de ambos (cuando fuente=MIX)

    Estructura de salida compatible con la grilla actual.
    """
    p = max(1, int(page or 1))
    s = min(200, max(1, int(size or 20)))
    off = (p - 1) * s

    # ----- SELECT MOV (base) -----
    sql_mov_base = """
      SELECT
        m.mov_id,                  -- 0
        m.mov_item_id,             -- 1
        i.item_codigo,             -- 2
        it.clase,                  -- 3
        it.nombre  AS item_tipo,   -- 4
        m.mov_tipo,                -- 5
        m.mov_fecha,               -- 6
        m.mov_origen_area_id,      -- 7
        ao.area_nombre AS origen_area_nombre,   -- 8
        m.mov_destino_area_id,     -- 9
        ad.area_nombre AS destino_area_nombre,  -- 10
        m.mov_equipo_id,           -- 11
        e.equipo_codigo,           -- 12
        e.equipo_nombre,           -- 13
        m.mov_usuario_app,         -- 14
        m.mov_motivo,              -- 15
        m.mov_detalle,             -- 16
        false AS es_audit          -- 17
      FROM inv.movimientos m
      LEFT JOIN inv.items       i  ON i.item_id = m.mov_item_id
      LEFT JOIN inv.item_tipos  it ON it.item_tipo_id = i.item_tipo_id
      LEFT JOIN inv.areas       ao ON ao.area_id = m.mov_origen_area_id
      LEFT JOIN inv.areas       ad ON ad.area_id = m.mov_destino_area_id
      LEFT JOIN inv.equipos     e  ON e.equipo_id = m.mov_equipo_id
      WHERE 1=1
    """

    mov_where, mov_params = _where_and_params_mov(tipo, desde, hasta, q, item_id, equipo_id, area_id)

    # --- REPARACION: sintetiza eventos por ciclo USO -> MANTENIMIENTO -> USO ---
    if (tipo or "").upper() == "REPARACION":
        rep_filters = []
        rep_params: List[Any] = []

        if desde:
            rep_filters.append("s.mov_fecha::date >= %s::date"); rep_params.append(desde)
        if hasta:
            rep_filters.append("s.mov_fecha::date <= %s::date"); rep_params.append(hasta)
        if equipo_id:
            rep_filters.append("s.mov_equipo_id = %s"); rep_params.append(int(equipo_id))
        if area_id:
            rep_filters.append("s.equipo_area_id = %s"); rep_params.append(int(area_id))
        if q:
            like = f"%{q}%"
            rep_filters.append("(s.equipo_codigo ILIKE %s OR s.equipo_nombre ILIKE %s)")
            rep_params.extend([like, like])

        sql_mov = f"""
          WITH estados AS (
            SELECT
              m.mov_id,
              m.mov_fecha,
              m.mov_equipo_id,
              e.equipo_codigo,
              e.equipo_nombre,
              e.equipo_area_id,
              (m.mov_detalle->>'before')::text AS before,
              (m.mov_detalle->>'after')::text  AS after,
              LAG( (m.mov_detalle->>'after')::text )
                  OVER (PARTITION BY m.mov_equipo_id ORDER BY m.mov_fecha, m.mov_id) AS prev_after,
              LEAD( (m.mov_detalle->>'after')::text )
                  OVER (PARTITION BY m.mov_equipo_id ORDER BY m.mov_fecha, m.mov_id) AS next_after
            FROM inv.movimientos m
            JOIN inv.equipos e ON e.equipo_id = m.mov_equipo_id
            WHERE m.mov_tipo = 'EQUIPO_ESTADO'
          )
          SELECT
            s.mov_id,                           -- 0
            NULL::bigint AS mov_item_id,        -- 1
            NULL::text   AS item_codigo,        -- 2
            NULL::text   AS clase,              -- 3
            NULL::text   AS item_tipo,          -- 4
            'REPARACION'::text AS mov_tipo,     -- 5
            s.mov_fecha,                        -- 6 (entrada a mantenimiento)
            NULL::bigint AS mov_origen_area_id, -- 7
            NULL::text   AS origen_area_nombre, -- 8
            NULL::bigint AS mov_destino_area_id,-- 9
            NULL::text   AS destino_area_nombre,--10
            s.mov_equipo_id,                    --11
            s.equipo_codigo,                    --12
            s.equipo_nombre,                    --13
            NULL::text   AS mov_usuario_app,    --14
            'ciclo_uso_mant_uso'::text AS mov_motivo, --15
            jsonb_build_object(
              'ciclo', 'USO->MANTENIMIENTO->USO',
              'before', s.before,
              'after',  s.after
            ) AS mov_detalle,                   --16
            false AS es_audit                   --17
          FROM estados s
          WHERE s.after='MANTENIMIENTO' AND s.prev_after='USO' AND s.next_after='USO'
          {("AND " + " AND ".join(rep_filters)) if rep_filters else ""}
        """
        mov_params = rep_params  # importante: usar los params del caso especial
    else:
        sql_mov = sql_mov_base + mov_where

    # ----- SELECT AUDIT -----
    sql_audit_base = """
      SELECT
        a.audit_id      AS mov_id,             -- 0
        NULL::bigint    AS mov_item_id,        -- 1
        NULL::text      AS item_codigo,        -- 2
        NULL::text      AS clase,              -- 3
        NULL::text      AS item_tipo,          -- 4
        a.accion        AS mov_tipo,           -- 5 (INSERT/UPDATE/DELETE)
        a.created_at    AS mov_fecha,          -- 6
        NULL::bigint    AS mov_origen_area_id, -- 7
        NULL::text      AS origen_area_nombre, -- 8
        NULL::bigint    AS mov_destino_area_id,-- 9
        NULL::text      AS destino_area_nombre,-- 10
        NULL::bigint    AS mov_equipo_id,      -- 11
        NULL::text      AS equipo_codigo,      -- 12
        NULL::text      AS equipo_nombre,      -- 13
        a.actor_user    AS mov_usuario_app,    -- 14
        COALESCE(a.extra->>'proc','AUDIT') AS mov_motivo, -- 15
        jsonb_build_object(
          'entidad', a.entidad,
          'entidad_id', a.entidad_id,
          'antes', a.antes,
          'despues', a.despues,
          'extra', a.extra
        ) AS mov_detalle,                      -- 16
        true AS es_audit                       -- 17
      FROM inv.audit_log a
      WHERE 1=1
    """
    audit_where, audit_params = _where_and_params_audit(desde, hasta, q)
    sql_audit = sql_audit_base + audit_where

    # ----- Ejecutar según fuente -----
    with get_conn(app_user) as (conn, cur):
        items: List[Dict[str, Any]] = []
        total = 0

        if fuente == "MOV":
            cur.execute("SELECT COUNT(1) FROM (" + sql_mov + ") x", mov_params)
            total = int(cur.fetchone()[0] or 0)

            sql_page = sql_mov + " ORDER BY mov_fecha DESC, mov_id DESC LIMIT %s OFFSET %s"
            cur.execute(sql_page, mov_params + [s, off])
            rows = cur.fetchall()

        elif fuente == "AUDIT":
            cur.execute("SELECT COUNT(1) FROM (" + sql_audit + ") x", audit_params)
            total = int(cur.fetchone()[0] or 0)

            sql_page = sql_audit + " ORDER BY a.created_at DESC, a.audit_id DESC LIMIT %s OFFSET %s"
            cur.execute(sql_page, audit_params + [s, off])
            rows = cur.fetchall()

        else:  # MIX
            cur.execute(
                "SELECT COUNT(1) FROM (" + f"({sql_mov}) UNION ALL ({sql_audit})" + ") z",
                mov_params + audit_params
            )
            total = int(cur.fetchone()[0] or 0)

            sql_union = f"({sql_mov}) UNION ALL ({sql_audit})"
            sql_page = sql_union + " ORDER BY mov_fecha DESC, mov_id DESC LIMIT %s OFFSET %s"
            cur.execute(sql_page, mov_params + audit_params + [s, off])
            rows = cur.fetchall()

        for r in rows:
            items.append({
                "mov_id": r[0],
                "mov_item_id": r[1],
                "item_codigo": r[2],
                "clase": r[3],
                "item_tipo": r[4],
                "mov_tipo": r[5],
                "mov_fecha": r[6],
                "mov_origen_area_id": r[7],
                "origen_area_nombre": r[8],
                "mov_destino_area_id": r[9],
                "destino_area_nombre": r[10],
                "mov_equipo_id": r[11],
                "equipo_codigo": r[12],
                "equipo_nombre": r[13],
                "mov_usuario_app": r[14],
                "mov_motivo": r[15],
                "mov_detalle": r[16],
                "es_audit": bool(r[17]),
            })

    return {"items": items, "total": int(total or 0), "page": p, "size": s}


# ====== wrapper de compatibilidad (solo MOV) ======
def list_movimientos(
    app_user: str,
    page: int = 1,
    size: int = 20,
    tipo: Optional[str] = None,
    desde: Optional[str] = None,
    hasta: Optional[str] = None,
    q: Optional[str] = None,
    item_id: Optional[int] = None,
    equipo_id: Optional[int] = None,
    area_id: Optional[int] = None,
) -> Dict[str, Any]:
    return list_auditoria_flexible(
        app_user,
        fuente="MOV",
        page=page, size=size,
        tipo=tipo, desde=desde, hasta=hasta, q=q,
        item_id=item_id, equipo_id=equipo_id, area_id=area_id
    )
