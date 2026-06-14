/**
 * Estado de erro partilhado pelos painéis que consomem React Query.
 */

interface QueryErrorPanelProps {
  message: string;
  onRetry: () => void;
}

export function QueryErrorPanel({ message, onRetry }: QueryErrorPanelProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center"
      role="alert"
    >
      <p className="text-xs text-danger">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-[11px] text-label border border-border-default rounded-sm px-2.5 py-1 hover:bg-surface-card-hover transition-colors"
      >
        Tentar novamente
      </button>
    </div>
  );
}
