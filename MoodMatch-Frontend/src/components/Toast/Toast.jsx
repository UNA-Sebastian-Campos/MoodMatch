import React, { useEffect } from 'react';
import './Toast.css';

const AUTO_DISMISS_MS = 3500;

const ICONS = {
  success: '✓',
  error:   '⚠',
  info:    'ℹ',
  warning: '!',
};

/**
 * Toast notification component.
 * Auto-dismisses after AUTO_DISMISS_MS.
 */
export default function Toast({ message, type = 'success', onDismiss }) {
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
      <span className="toast__icon" aria-hidden="true">{ICONS[type]}</span>
      <p className="toast__message">{message}</p>
      <button
        className="toast__close"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
}
