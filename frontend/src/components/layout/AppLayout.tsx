// frontend/src/components/AppLayout.tsx
import { type PropsWithChildren, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { getUser, logout } from "@/services/authService";
import IncidenciaNotifier from "@/components/widgets/IncidenciaNotifier";

/* =========================
   Paleta de colores
========================= */
const BG_APP = "bg-[#FFFDF8]"; // crema suave
const TEXT = "text-slate-800";
const NAV_SHADOW = "shadow-[0_1px_0_rgba(0,0,0,0.04)]";
const CONTAINER = "mx-auto w-full max-w-7xl px-3 sm:px-4 md:px-6";

/* Color principal: TURQUESA */
const COLOR_TURQUESA = "#80F9FA";
const COLOR_TURQUESA_HOVER = "#5EE6E7";

/* Estilos base de botones */
const btnPrimary = `
  inline-flex items-center h-10 rounded-xl px-4 text-sm font-medium 
  text-slate-900 transition
`;
const btnNeutral = `
  inline-flex items-center h-10 rounded-xl px-4 text-sm font-medium 
  bg-slate-900 text-white hover:bg-slate-800 transition
`;

/* Logo Hospital */
function HospitalLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 100 20 10 10 0 000-20Zm1 5v4h4v2h-4v4h-2v-4H7v-2h4V7h2Z" />
    </svg>
  );
}

/* =========================
   Navbar principal
========================= */
function TopNav() {
  const u = getUser();
  const [open, setOpen] = useState(false);

  const linkBase =
    "inline-flex items-center h-10 rounded-lg px-3 text-sm font-medium transition whitespace-nowrap";
  const linkIdle = "text-slate-600 hover:text-slate-900 hover:bg-slate-100";
  const linkActive = "text-slate-900 bg-slate-100 ring-1 ring-slate-200";

  return (
    <header
      className={`sticky top-0 z-40 bg-white/95 backdrop-blur ${NAV_SHADOW} border-b border-slate-200`}
      role="banner"
    >
      <div className={`${CONTAINER} h-16 flex items-center justify-between`}>
        {/* LOGO */}
        <div className="flex items-center gap-3">
          <Link to={u ? "/" : "/login"} className="flex items-center gap-2">
            <div
              className="h-10 w-10 rounded-2xl text-slate-900 flex items-center justify-center shadow-sm"
              style={{ backgroundColor: COLOR_TURQUESA }}
            >
              <HospitalLogo />
            </div>
            <div className="leading-tight">
              <div className="text-base font-semibold text-slate-900">Inventario</div>
              <div className="text-[12px] text-slate-500">Hospital · Soporte TI</div>
            </div>
          </Link>
        </div>

        {/* NAV SOLO SI HAY SESIÓN */}
        {u ? (
          <nav className="hidden md:flex items-center gap-1" aria-label="Principal">
            {u.rol !== "USUARIO" && (
              <NavLink to="/areas" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}>
                Áreas
              </NavLink>
            )}
            {u.rol === "ADMIN" ? (
              <NavLink to="/incidencias" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}>
                Incidencias
              </NavLink>
            ) : (
              <NavLink
                to="/mis-incidencias"
                className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}
              >
                Mis incidencias
              </NavLink>
            )}
            {u.rol === "ADMIN" && (
              <>
                <NavLink
                  to="/auditorias"
                  className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}
                >
                  Auditorías
                </NavLink>
                <NavLink to="/users" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}>
                  Usuarios
                </NavLink>
              </>
            )}
          </nav>
        ) : (
          <nav className="hidden md:flex items-center gap-1" />
        )}

        {/* PERFIL / LOGIN */}
        <div className="hidden md:flex items-center gap-3">
          {u ? (
            <>
              <NavLink
                to="/profile"
                className="inline-flex items-center h-10 rounded-full px-3 text-sm bg-slate-100 text-slate-700 ring-1 ring-slate-200"
              >
                {u.username} · {u.rol}
              </NavLink>
              <button
                className={btnPrimary}
                style={{ backgroundColor: COLOR_TURQUESA }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = COLOR_TURQUESA_HOVER)}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = COLOR_TURQUESA)}
                onClick={() => {
                  logout();
                  location.href = "/login";
                }}
              >
                Salir
              </button>
            </>
          ) : (
            <Link to="/login" className={btnNeutral}>
              Entrar
            </Link>
          )}
        </div>

        {/* MENU MÓVIL */}
        <div className="md:hidden flex items-center gap-2">
          {u && (
            <Link
              to="/profile"
              className="inline-flex items-center h-9 rounded-full px-3 text-xs bg-slate-100 text-slate-700 ring-1 ring-slate-200"
            >
              {u.username}
            </Link>
          )}
          <button
            className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-100"
            onClick={() => setOpen((s) => !s)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      </div>

      <MobileMenu open={open} setOpen={setOpen} />
    </header>
  );
}

/* =========================
   Menú móvil
========================= */
function MobileMenu({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const u = getUser();
  if (!open) return null;

  const link = (isActive: boolean) =>
    `block rounded-xl px-3 py-3 text-sm ${
      isActive ? "bg-slate-100 text-slate-900 ring-1 ring-slate-200" : "text-slate-700 hover:bg-slate-100"
    }`;

  return (
    <div className={`${CONTAINER} md:hidden pb-3`}>
      {u ? (
        <nav className="grid gap-2 pt-2">
          {u.rol !== "USUARIO" && (
            <NavLink to="/areas" className={({ isActive }) => link(isActive)} onClick={() => setOpen(false)}>
              Áreas
            </NavLink>
          )}
          {u.rol === "ADMIN" ? (
            <NavLink to="/incidencias" className={({ isActive }) => link(isActive)} onClick={() => setOpen(false)}>
              Incidencias
            </NavLink>
          ) : (
            <NavLink to="/mis-incidencias" className={({ isActive }) => link(isActive)} onClick={() => setOpen(false)}>
              Mis incidencias
            </NavLink>
          )}
          {u.rol === "ADMIN" && (
            <>
              <NavLink to="/auditorias" className={({ isActive }) => link(isActive)} onClick={() => setOpen(false)}>
                Auditorías
              </NavLink>
              <NavLink to="/users" className={({ isActive }) => link(isActive)} onClick={() => setOpen(false)}>
                Usuarios
              </NavLink>
            </>
          )}
          <div className="mt-2 flex items-center gap-2">
            <NavLink
              to="/profile"
              className="flex-1 inline-flex items-center justify-center h-10 rounded-xl bg-slate-100 text-slate-800 ring-1 ring-slate-200"
              onClick={() => setOpen(false)}
            >
              {u.username} · {u.rol}
            </NavLink>
            <button
              className={btnPrimary}
              style={{ backgroundColor: COLOR_TURQUESA }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = COLOR_TURQUESA_HOVER)}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = COLOR_TURQUESA)}
              onClick={() => {
                logout();
                location.href = "/login";
              }}
            >
              Salir
            </button>
          </div>
        </nav>
      ) : (
        <nav className="grid gap-2 pt-2">
          <Link to="/login" className={btnNeutral} onClick={() => setOpen(false)}>
            Entrar
          </Link>
        </nav>
      )}
    </div>
  );
}

/* =========================
   Layout principal
========================= */
export default function AppLayout({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const u = getUser();

  return (
    <div className={`${BG_APP} ${TEXT} min-h-screen`}>
      <TopNav />
      <main>{children}</main>
      <IncidenciaNotifier
        pollMs={1500}
        onOpenIncidencia={() => {
          if (u?.rol === "ADMIN") navigate("/incidencias");
          else navigate("/mis-incidencias");
        }}
      />
    </div>
  );
}
