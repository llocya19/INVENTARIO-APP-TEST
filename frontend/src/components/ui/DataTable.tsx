import clsx from "clsx";
import { surfaceCard } from "./tokens";

export type Column<T> = {
  key: keyof T | string;
  header: string | React.ReactNode;
  className?: string;
  render?: (row: T, idx: number) => React.ReactNode;
};

export default function DataTable<T>({
  columns,
  rows,
  emptyText = "Sin datos",
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  emptyText?: string;
  className?: string;
}) {
  return (
    <section className={clsx(surfaceCard, "p-0 overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-slate-700">
              {columns.map((c, i) => (
                <th
                  key={String(c.key) + i}
                  className={clsx(
                    "px-3 py-2 font-medium border-b border-slate-200 sticky top-0 bg-slate-50",
                    c.className
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-8 text-center text-slate-500"
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className={clsx(
                    "border-b border-slate-100",
                    rIdx % 2 === 1 && "bg-white"
                  )}
                >
                  {columns.map((c, cIdx) => (
                    <td key={String(c.key) + cIdx} className={clsx("px-3 py-2", c.className)}>
                      {c.render
                        ? c.render(row, rIdx)
                        : 
                          (row as any)[c.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
