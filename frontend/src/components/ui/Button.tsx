import * as React from "react";

// ✅ Incluimos las variantes que usas en otras vistas
export type Variant =
  | "primary"
  | "secondary"
  | "outline"
  | "danger"
  | "ghost"
  | "soft-emerald"
  | "accent";

export type Size = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/** Botón unificado con tema turquesa (#80F9FA) */
export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition " +
    "disabled:opacity-50 disabled:cursor-not-allowed";

  const sizeCls: Record<Size, string> = {
    sm: "text-sm px-3 py-2 min-h-[36px]",
    md: "text-sm px-4 py-3 min-h-[44px]",
    lg: "text-base px-5 py-3.5 min-h-[48px]",
  };

  // 🎨 Mapa de estilos (turquesa como color principal)
  const variantCls: Record<Variant, string> = {
    primary:
      "bg-[#80F9FA] text-slate-900 hover:bg-[#6DE2E3] active:bg-[#5FD0D1] shadow-sm",
    secondary:
      "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50",
    outline:
      "bg-transparent text-slate-800 border border-slate-300 hover:bg-[#E0F9FA]",
    danger:
      "bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800",
    ghost:
      "bg-transparent text-slate-700 hover:bg-slate-100",

    // ✅ Variantes que faltaban
    "soft-emerald":
      "bg-[#EFFFFF] text-slate-800 border border-[#80F9FA]/50 hover:bg-[#E0FEFF]",
    accent:
      "bg-[#B9FEFF] text-slate-900 hover:bg-[#A3F0F1] active:bg-[#8FE1E2]",
  };

  return (
    <button
      className={`${base} ${sizeCls[size]} ${variantCls[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
