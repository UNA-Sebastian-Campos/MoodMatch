import React, { useEffect } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import './Toast.css';

const AUTO_DISMISS_MS = 3500;

const ICONS = {
  success: CheckCircle2,
  error:   AlertTriangle,
  info:    Info,
  warning: AlertCircle,
};

/**
 * Toast notification component.
 * Auto-dismisses after AUTO_DISMISS_MS.
 */
export default function Toast({ message, type = 'success', onDismiss }) {
  const Icon = ICONS[type] || CheckCircle2;

  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={`toast toast--${type}`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <span className="toast__icon" aria-hidden="true"><Icon size={18} /></span>
      <p className="toast__message">{message}</p>
      <button
        className="toast__close"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  );
}
