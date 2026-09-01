import { Button } from './Button';

interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, totalItems, onPageChange }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  if (pageCount <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="pagination">
      <span className="small-text">
        {start}–{end} de {totalItems}
      </span>
      <div className="pagination-controls">
        <Button size="small" variant="secondary" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          Anterior
        </Button>
        <span className="small-text mono">
          {page} / {pageCount}
        </span>
        <Button size="small" variant="secondary" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount}>
          Próxima
        </Button>
      </div>
    </div>
  );
}
