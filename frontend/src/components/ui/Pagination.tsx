import Button from "./Button";

type Props = {
  page: number;
  size: number;
  total: number;
  onChange: (page: number) => void;
};

export default function Pagination({ page, size, total, onChange }: Props) {
  const pages = Math.max(1, Math.ceil(total / size));
  const canPrev = page > 1;
  const canNext = page < pages;

  return (
    <div className="mt-3 flex items-center justify-between text-sm">
      <div className="text-slate-600">
        Página {page} de {pages} · {total} registros
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={!canPrev} onClick={() => onChange(page - 1)}>
          ← Anterior
        </Button>
        <Button variant="outline" size="sm" disabled={!canNext} onClick={() => onChange(page + 1)}>
          Siguiente →
        </Button>
      </div>
    </div>
  );
}
