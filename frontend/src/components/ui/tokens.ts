// Paleta e invariantes visuales del hospital (Mostaza + Blanco)
export const colors = {
  // Base
  white: "#FFFFFF",
  appBg: "#FFFDF8",         // crema base
  text: "#2C2C2C",
  textMuted: "#6B7280",
  border: "#E5E7EB",

  // Primario (Mostaza)
  primary: "#cab74dff",
  primaryHover: "#a79844ff",
  primaryActive: "#ad9c37ff",

  // Secundario (Éxito clínico)
  success: "#4e8662ff",
  successHover: "#517a60ff",
  successActive: "#436952ff",

  // Estado
  error: "#DC2626",
};

// Paleta y utilidades de estilo (tema hospital: mostaza + blanco)
export const container =
  "mx-auto max-w-7xl px-3 sm:px-4 md:px-6";

export const surfaceSection =
  "rounded-2xl border border-slate-200 bg-white shadow-sm";

export const surfaceCard =
  "rounded-2xl border border-slate-200 bg-white shadow-sm";

// Input base (usada en selects/inputs de AreaView)
export const fieldBase =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-[15px] " +
  "text-slate-800 placeholder-slate-400 " +
  "focus:outline-none focus:ring-2 focus:ring-amber-300/40 focus:border-amber-300/60 " +
  "transition";
