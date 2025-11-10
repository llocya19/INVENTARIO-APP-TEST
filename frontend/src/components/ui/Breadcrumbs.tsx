import { Link } from "react-router-dom";
import clsx from "clsx";
import { container } from "./tokens";

type Crumb = { label: string; to?: string };

export default function Breadcrumbs({
  items,
  className,
}: {
  items: Crumb[];
  className?: string;
}) {
  return (
    <div className={clsx(container, "py-2", className)}>
      <nav className="text-sm text-slate-600" aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-2">
          {items.map((c, i) => (
            <li key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-slate-400">›</span>}
              {c.to ? (
                <Link
                  to={c.to}
                  className="hover:text-slate-900 underline-offset-4 hover:underline"
                >
                  {c.label}
                </Link>
              ) : (
                <span className="text-slate-900">{c.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
