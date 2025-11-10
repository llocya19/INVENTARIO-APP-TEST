import { useNavigate } from "react-router-dom";
import Button from "./Button";
import { container, surfaceSection } from "./tokens";

export default function PageHeader({
  title,
  subtitle,
  onBack,
  actions,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
}) {
  const nav = useNavigate();
  const goBack = () => (onBack ? onBack() : nav(-1));

  return (
    <header className={`${container} pt-4`}>
      <section className={`${surfaceSection} px-4 py-4 md:px-6 md:py-5`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {onBack !== null && (
                <Button variant="ghost" size="sm" onClick={goBack} aria-label="Volver">
                  ← Volver
                </Button>
              )}
              <h1 className="text-[22px] md:text-[26px] font-semibold text-slate-900 truncate">
                {title}
              </h1>
            </div>
            {subtitle && (
              <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      </section>
    </header>
  );
}
