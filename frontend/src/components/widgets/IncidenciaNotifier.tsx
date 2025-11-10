import { useCallback, useEffect, useRef, useState } from "react";
import { fetchUpdates, type UpdateItem } from "@/api/incidencias";
import { getUser } from "@/services/authService";

const HEARTBEAT_MS = 4000;
const LOCK_TTL_MS  = 7000;
const BASE_POLL_MS = 1500;

type BroadcastMsg =
  | { type: "prime"; last_id: number }
  | { type: "updates"; items: UpdateItem[]; last_id: number }
  | { type: "leader:claimed"; id: string }
  | { type: "leader:released"; id: string };

const BRAND = "#80F9FA";

function Bubble({
  title, subtitle, onClick, onClose,
}: { title: string; subtitle?: string; onClick: () => void; onClose: () => void; }) {
  return (
    <div className="fixed right-4 bottom-4 z-[60] animate-[fadeIn_.15s_ease-out]">
      <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg ring-1 ring-slate-200 w-[320px] overflow-hidden">
        <div className="px-4 py-3 flex items-start gap-3">
          <div
            className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: BRAND, color: "#0f172a" /* slate-900 */ }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 3a9 9 0 00-9 9 9 9 0 001.7 5.2L3 21l3.1-1.6A9 9 0 1012 3z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{title}</div>
            {subtitle && <div className="text-xs text-slate-600 line-clamp-2">{subtitle}</div>}
            <div className="mt-2 flex items-center gap-2">
              <button
                className="inline-flex h-9 px-3 rounded-lg text-sm shadow-sm"
                style={{ backgroundColor: BRAND, color: "#0f172a" }}
                onClick={onClick}
                onMouseEnter={(e) => ((e.currentTarget.style.backgroundColor = "#6ee7e9"))}
                onMouseLeave={(e) => ((e.currentTarget.style.backgroundColor = BRAND))}
              >
                Abrir chat
              </button>
              <button className="inline-flex h-9 px-3 rounded-lg text-sm bg-white border border-slate-300 hover:bg-slate-50" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:.001;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

export default function IncidenciaNotifier({
  pollMs = BASE_POLL_MS,
  onOpenIncidencia,
}: { pollMs?: number; onOpenIncidencia?: (id: number) => void; }) {
  const me = getUser();
  const myUser = (me?.username || "").toLowerCase();
  const rol = (me?.rol || "USUARIO").toUpperCase();
  const isUser = rol === "USUARIO";

  const LS_LAST      = `incfeed.last_id.v3:${myUser}:${rol}`;
  const LS_PRIMED_AT = `incfeed.primed_at.v3:${myUser}:${rol}`;
  const LS_LEADER    = `incfeed.leader.v1:${myUser}:${rol}`;
  const CH_NAME      = `incfeed.channel.v1:${myUser}:${rol}`;

  const readLast = () => { try { return Number(localStorage.getItem(LS_LAST) || "0"); } catch { return 0; } };
  const writeLast = (v: number) => { try { localStorage.setItem(LS_LAST, String(v)); } catch {} };
  const primed = () => !!localStorage.getItem(LS_PRIMED_AT);
  const writePrimed = () => { try { localStorage.setItem(LS_PRIMED_AT, new Date().toISOString()); } catch {} };

  const now = () => Date.now();
  const newTabId = () => (crypto?.randomUUID?.() || String(Math.random()));

  const readLeader = () => {
    try {
      const raw = localStorage.getItem(LS_LEADER);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj.until !== "number") return null;
      return obj as { id: string; until: number };
    } catch { return null; }
  };
  const tryBecomeLeader = (myId: string) => {
    const current = readLeader();
    const expired = !current || current.until < now();
    if (!expired) return false;
    const candidate = { id: myId, until: now() + LOCK_TTL_MS };
    localStorage.setItem(LS_LEADER, JSON.stringify(candidate));
    const after = readLeader();
    return !!after && after.id === myId;
  };
  const refreshLeader = (myId: string) => {
    const current = readLeader();
    if (!current || current.id !== myId) return false;
    const refreshed = { id: myId, until: now() + LOCK_TTL_MS };
    localStorage.setItem(LS_LEADER, JSON.stringify(refreshed));
    return true;
  };
  const releaseLeader = (myId: string) => {
    const current = readLeader();
    if (current && current.id === myId) {
      localStorage.removeItem(LS_LEADER);
    }
  };

  const [toast, setToast] = useState<{ id: number; titulo: string; preview?: string } | null>(null);

  const lastIdRef = useRef<number>(readLast());
  const busyRef   = useRef(false);

  const tabIdRef    = useRef<string>(newTabId());
  const isLeaderRef = useRef<boolean>(false);
  const bcRef       = useRef<BroadcastChannel | null>(null);

  const prime = useCallback(async () => {
    if (primed()) return;
    const r = await fetchUpdates(undefined);
    lastIdRef.current = r.last_id || 0;
    writeLast(lastIdRef.current);
    writePrimed();
    bcRef.current?.postMessage({ type: "prime", last_id: lastIdRef.current } as BroadcastMsg);
  }, []);

  const pickItemForMe = useCallback((items: UpdateItem[]) => {
    for (const it of items) {
      if (typeof it.msg_id === "number" && it.msg_id <= (lastIdRef.current || 0)) continue;
      if ((it.usuario || "").toLowerCase() === myUser) continue;

      if (isUser) {
        if (it.type === "MSG" && it.visibilidad === "PUBLIC") return it;
        continue;
      }
      if (it.type === "MSG") return it;
      if (rol === "ADMIN" && it.type === "NEW_INC") return it;
      if (rol === "PRACTICANTE" && it.type === "ASSIGNED") return it;
    }
    return null;
  }, [isUser, myUser, rol]);

  const handleIncoming = useCallback((items: UpdateItem[], last_id: number) => {
    if (items?.length) {
      const first = pickItemForMe(items);
      if (first) {
        const title =
          first.type === "NEW_INC" ? `Nueva incidencia #${first.inc_id} · ${first.titulo}` :
          first.type === "ASSIGNED" ? `Te asignaron #${first.inc_id} · ${first.titulo}` :
          `Nueva respuesta en #${first.inc_id} · ${first.titulo}`;
        setToast({ id: first.inc_id, titulo: title, preview: (first.mensaje || "").slice(0, 120) });
      }
    }
    if (typeof last_id === "number" && last_id > (lastIdRef.current || 0)) {
      lastIdRef.current = last_id;
      writeLast(lastIdRef.current);
    }
  }, [pickItemForMe]);

  const tick = useCallback(async () => {
    if (!isLeaderRef.current) return;
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const r = await fetchUpdates(lastIdRef.current || 0);
      if ((r.items?.length ?? 0) > 0 || (typeof r.last_id === "number" && r.last_id > lastIdRef.current)) {
        bcRef.current?.postMessage({ type: "updates", items: r.items || [], last_id: r.last_id || lastIdRef.current } as BroadcastMsg);
        handleIncoming(r.items || [], r.last_id || lastIdRef.current);
      }
    } finally {
      busyRef.current = false;
    }
  }, [handleIncoming]);

  useEffect(() => {
    const bc = new BroadcastChannel(CH_NAME);
    bcRef.current = bc;

    const onMsg = (ev: MessageEvent<BroadcastMsg>) => {
      const msg = ev.data;
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "updates") {
        handleIncoming(msg.items || [], msg.last_id || 0);
      } else if (msg.type === "prime") {
        if (!primed()) {
          lastIdRef.current = msg.last_id || lastIdRef.current;
          writeLast(lastIdRef.current);
          writePrimed();
        }
      }
    };
    bc.addEventListener("message", onMsg as any);

    const claimLeader = () => {
      if (isLeaderRef.current) return;
      if (tryBecomeLeader(tabIdRef.current)) {
        isLeaderRef.current = true;
        bc.postMessage({ type: "leader:claimed", id: tabIdRef.current } as BroadcastMsg);
      }
    };
    const release = () => {
      if (isLeaderRef.current) {
        releaseLeader(tabIdRef.current);
        isLeaderRef.current = false;
        bc.postMessage({ type: "leader:released", id: tabIdRef.current } as BroadcastMsg);
      }
    };

    claimLeader();

    const hb = setInterval(() => {
      if (isLeaderRef.current) {
        if (!refreshLeader(tabIdRef.current)) isLeaderRef.current = false;
      } else {
        claimLeader();
      }
    }, HEARTBEAT_MS);

    prime().catch(() => {});
    const base = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      tick().catch(() => {});
    }, pollMs);

    return () => {
      clearInterval(base);
      clearInterval(hb);
      release();
      bc.removeEventListener("message", onMsg as any);
      bc.close();
    };
  }, [CH_NAME, LS_LEADER, pollMs, prime, tick, handleIncoming]);

  const open = () => {
    const id = toast?.id;
    setToast(null);
    if (id) onOpenIncidencia?.(id);
  };

  return toast ? (
    <Bubble title={toast.titulo} subtitle={toast.preview} onClick={open} onClose={() => setToast(null)} />
  ) : null;
}
