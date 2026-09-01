import type { ToastItem } from '../../hooks/useToast';

interface ToastStackProps {
  toasts: ToastItem[];
}

export function ToastStack({ toasts }: ToastStackProps) {
  if (!toasts.length) return null;
  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast show ${toast.tone !== 'default' ? toast.tone : ''}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
