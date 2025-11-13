# backend/app/utils/mailer.py
import os
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr
from typing import Iterable, Optional, Dict, Any

MAIL_HOST = os.getenv("MAIL_HOST", "smtp.gmail.com")
MAIL_PORT = int(os.getenv("MAIL_PORT", "587"))
MAIL_USER = os.getenv("MAIL_USERNAME") or os.getenv("MAIL_USER")
MAIL_PASS = os.getenv("MAIL_PASSWORD") or os.getenv("MAIL_PASS")
MAIL_FROM = os.getenv("MAIL_FROM") or os.getenv("FROM_EMAIL") or (MAIL_USER or "")
MAIL_FROM_NAME = os.getenv("MAIL_FROM_NAME", "Soporte TI")
ADMIN_TO = os.getenv("MAIL_ADMIN_TO") or os.getenv("ADMIN_EMAIL") or MAIL_FROM

MAIL_USE_SSL = os.getenv("MAIL_USE_SSL", "false").lower() in ("1", "true", "yes")
MAIL_DEBUG = int(os.getenv("MAIL_DEBUG", "0"))
MAIL_CA_BUNDLE = os.getenv("MAIL_CA_BUNDLE")  # ruta opcional a .pem


# -----------------------------
# Helpers
# -----------------------------
def _is_valid_email(s: Optional[str]) -> bool:
    return bool(s and "@" in s and "." in s and " " not in s and "<" not in s and ">" not in s)


def _as_list(addr: Optional[Iterable[str] | str]) -> list[str]:
    if not addr:
        return []
    if isinstance(addr, str):
        return [addr]
    return [a for a in addr if a]


# -----------------------------
# Construcción del mensaje
# -----------------------------
def _build_message(
    subject: str,
    body: str,
    to: Iterable[str],
    *,
    reply_to: Optional[str] = None,
    cc: Optional[Iterable[str]] = None,
    bcc: Optional[Iterable[str]] = None,
    from_name_extra: Optional[str] = None,
    extra_headers: Optional[Dict[str, Any]] = None,
) -> EmailMessage:

    msg = EmailMessage()
    msg["Subject"] = subject

    from_display = MAIL_FROM_NAME if not from_name_extra else f"{MAIL_FROM_NAME} ({from_name_extra})"
    msg["From"] = formataddr((from_display, MAIL_FROM))

    to_list = _as_list(to)
    cc_list = _as_list(cc)
    bcc_list = _as_list(bcc)

    if to_list:
        msg["To"] = ", ".join(to_list)
    if cc_list:
        msg["Cc"] = ", ".join(cc_list)
    if _is_valid_email(reply_to):
        msg["Reply-To"] = reply_to

    if extra_headers:
        for k, v in extra_headers.items():
            if v is not None:
                msg[k] = str(v)

    msg.set_content(body)

    if bcc_list:
        msg._bcc = bcc_list  # type: ignore[attr-defined]

    return msg


# -----------------------------
# SSL Context seguro
# -----------------------------
def _make_ssl_context() -> ssl.SSLContext:
    """
    Construye un contexto SSL seguro con:
    - Validación de certificado
    - Verificación del hostname del servidor
    - TLS 1.2 o superior
    """
    # 1) Intentar usar CA bundle del entorno
    if MAIL_CA_BUNDLE and os.path.exists(MAIL_CA_BUNDLE):
        ctx = ssl.create_default_context(cafile=MAIL_CA_BUNDLE)
    else:
        # 2) Intentar usar certifi
        try:
            import certifi
            ctx = ssl.create_default_context(cafile=certifi.where())
        except Exception:
            # 3) Fallback al sistema
            ctx = ssl.create_default_context()

    # Verificación estricta
    ctx.check_hostname = True
    ctx.verify_mode = ssl.CERT_REQUIRED

    # Forzar TLS 1.2 como mínimo si está disponible
    if hasattr(ssl, "TLSVersion"):
        try:
            ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        except Exception:
            pass

    return ctx


# -----------------------------
# Envío seguro de correos
# -----------------------------
def send_mail_safe(
    subject: str,
    body: str,
    to: Optional[Iterable[str] | str] = None,
    *,
    reply_to: Optional[str] = None,
    cc: Optional[Iterable[str] | str] = None,
    bcc: Optional[Iterable[str] | str] = None,
    from_name_extra: Optional[str] = None,
    extra_headers: Optional[Dict[str, Any]] = None,
    enrich_subject_with_reporter: Optional[str] = None,
) -> bool:

    dest = _as_list(to) or _as_list(ADMIN_TO)
    cc_list = _as_list(cc)
    bcc_list = _as_list(bcc)

    if enrich_subject_with_reporter:
        subject = f"{subject} · por {enrich_subject_with_reporter}"

    if not (MAIL_HOST and MAIL_PORT and MAIL_USER and MAIL_PASS and MAIL_FROM and dest):
        print("[mailer] configuración SMTP incompleta; mensaje no enviado")
        return False

    try:
        ctx = _make_ssl_context()

        if MAIL_USE_SSL:
            # SSL directo (puerto 465)
            with smtplib.SMTP_SSL(MAIL_HOST, MAIL_PORT, timeout=25, context=ctx) as s:
                s.set_debuglevel(MAIL_DEBUG)
                s.login(MAIL_USER, MAIL_PASS)

                msg = _build_message(
                    subject, body, dest,
                    reply_to=reply_to,
                    cc=cc_list, bcc=bcc_list,
                    from_name_extra=from_name_extra,
                    extra_headers=extra_headers
                )

                all_rcpt = dest + cc_list + getattr(msg, "_bcc", [])
                s.send_message(msg, from_addr=MAIL_FROM, to_addrs=all_rcpt)

        else:
            # STARTTLS (puerto 587)
            with smtplib.SMTP(MAIL_HOST, MAIL_PORT, timeout=25) as s:
                s.set_debuglevel(MAIL_DEBUG)
                s.ehlo()
                s.starttls(context=ctx)  # ← TLS seguro
                s.ehlo()
                s.login(MAIL_USER, MAIL_PASS)

                msg = _build_message(
                    subject, body, dest,
                    reply_to=reply_to,
                    cc=cc_list, bcc=bcc_list,
                    from_name_extra=from_name_extra,
                    extra_headers=extra_headers
                )

                all_rcpt = dest + cc_list + getattr(msg, "_bcc", [])
                s.send_message(msg, from_addr=MAIL_FROM, to_addrs=all_rcpt)

        return True

    except Exception as e:
        print(f"[mailer] error enviando correo: {e}")
        return False
