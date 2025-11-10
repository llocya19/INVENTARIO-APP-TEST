type Props = {
  kind?: "info" | "success" | "warning" | "error";
  title?: string;
  children?: React.ReactNode;
  onClose?: () => void;
};

const color: Record<NonNullable<Props["kind"]>, string> = {
  info: "bg-sky-50 border-sky-200 text-sky-900",
  success: "bg-emerald-50 border-emerald-200 text-emerald-900",
  warning: "bg-amber-50 border-amber-200 text-amber-900",
  error: "bg-rose-50 border-rose-200 text-rose-900",
};

export default function InlineAlert({
  kind = "info",
  title,
  children,
  onClose,
}: Props) {
  return (
    <div
      className={`border rounded-xl px-3 py-2 ${color[kind]} flex items-start gap-3`}
      role="alert"
    >
      <div className="flex-1 min-w-0">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className="text-sm">{children}</div>}
      </div>
      {onClose && (
        <button
          className="ml-2 opacity-70 hover:opacity-100"
          onClick={onClose}
          aria-label="Cerrar alerta"
        >
          ✕
        </button>
      )}
    </div>
  );
}
