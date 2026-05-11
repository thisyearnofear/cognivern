/** @jsxImportSource @emotion/react */
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { designTokens } from '../../styles/design-system';
import { css, keyframes } from '@emotion/react';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ToastProps extends ToastItem {
  onClose: (id: string) => void;
}

// Context types
interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  warning: (message: string, duration?: number) => string;
  info: (message: string, duration?: number) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Animations
const slideIn = keyframes`
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
`;

const slideOut = keyframes`
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(100%); opacity: 0; }
`;

const slideUp = keyframes`
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

const progress = keyframes`
  from { width: 100%; }
  to { width: 0%; }
`;

const iconConfig = {
  success: { Icon: CheckCircle, color: designTokens.colors.semantic.success[600] },
  error: { Icon: XCircle, color: designTokens.colors.semantic.error[600] },
  warning: { Icon: AlertTriangle, color: designTokens.colors.semantic.warning[600] },
  info: { Icon: Info, color: designTokens.colors.semantic.info[600] },
};

// Toast item component
const ToastItemComponent: React.FC<{
  toast: ToastItem;
  onClose: (id: string) => void;
}> = ({ toast, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);
  const { Icon, color } = iconConfig[toast.type];
  const duration = toast.duration ?? (toast.type === 'error' ? 8000 : 5000);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => onClose(toast.id), 300);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, toast.id, onClose]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onClose(toast.id), 300);
  };

  return (
    <div
      css={css`
        display: flex;
        align-items: flex-start;
        gap: ${designTokens.spacing[3]};
        padding: ${designTokens.spacing[4]};
        background: var(--toast-bg);
        border: 1px solid var(--toast-border);
        border-radius: ${designTokens.borderRadius.lg};
        box-shadow: ${designTokens.shadows.lg};
        max-width: 400px;
        animation: ${isExiting ? slideOut : slideIn} 0.3s ease-out;
        position: relative;
        overflow: hidden;

        ${toast.type === 'success' &&
        css`
          --toast-bg: ${designTokens.colors.semantic.success[50]};
          --toast-border: ${designTokens.colors.semantic.success[200]};
        `}
        ${toast.type === 'error' &&
        css`
          --toast-bg: ${designTokens.colors.semantic.error[50]};
          --toast-border: ${designTokens.colors.semantic.error[200]};
        `}
        ${toast.type === 'warning' &&
        css`
          --toast-bg: ${designTokens.colors.semantic.warning[50]};
          --toast-border: ${designTokens.colors.semantic.warning[200]};
        `}
        ${toast.type === 'info' &&
        css`
          --toast-bg: ${designTokens.colors.primary[50]};
          --toast-border: ${designTokens.colors.primary[200]};
        `}
      `}
      role="alert"
      aria-live="polite"
    >
      <span
        css={css`
          color: ${color};
          flex-shrink: 0;
          margin-top: 2px;
        `}
      >
        <Icon size={20} />
      </span>

      <div
        css={css`
          flex: 1;
          min-width: 0;
        `}
      >
        <p
          css={css`
            font-size: ${designTokens.typography.fontSize.sm};
            font-weight: ${designTokens.typography.fontWeight.medium};
            color: var(--text-primary);
            line-height: 1.4;
          `}
        >
          {toast.message}
        </p>

        {toast.action && (
          <button
            css={css`
              margin-top: ${designTokens.spacing[2]};
              padding: ${designTokens.spacing[1]} ${designTokens.spacing[3]};
              font-size: ${designTokens.typography.fontSize.xs};
              font-weight: ${designTokens.typography.fontWeight.medium};
              color: ${color};
              background: transparent;
              border: 1px solid var(--toast-border);
              border-radius: ${designTokens.borderRadius.sm};
              cursor: pointer;
              transition: all 0.15s;

              &:hover {
                background: var(--toast-border);
              }
            `}
            onClick={toast.action.onClick}
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        css={css`
          flex-shrink: 0;
          padding: ${designTokens.spacing[1]};
          color: var(--text-muted);
          background: transparent;
          border: none;
          border-radius: ${designTokens.borderRadius.sm};
          cursor: pointer;
          transition: color 0.15s;

          &:hover {
            color: var(--text-primary);
          }
        `}
        onClick={handleClose}
        aria-label="Dismiss notification"
      >
        <XCircle size={18} />
      </button>

      {/* Progress bar */}
      {duration > 0 && (
        <div
          css={css`
            position: absolute;
            bottom: 0;
            left: 0;
            height: 3px;
            background: ${color};
            animation: ${progress} ${duration}ms linear forwards;
          `}
        />
      )}
    </div>
  );
};

// Toast container
const ToastContainer: React.FC<{
  toasts: ToastItem[];
  onClose: (id: string) => void;
}> = ({ toasts, onClose }) => (
  <div
    css={css`
      position: fixed;
      top: ${designTokens.spacing[4]};
      right: ${designTokens.spacing[4]};
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: ${designTokens.spacing[3]};
      max-height: calc(100vh - ${designTokens.spacing[8]});
      overflow-y: auto;

      &::-webkit-scrollbar {
        width: 6px;
      }
      &::-webkit-scrollbar-track {
        background: transparent;
      }
      &::-webkit-scrollbar-thumb {
        background: var(--border-subtle);
        border-radius: 3px;
      }
    `}
  >
    {toasts.map((toast) => (
      <ToastItemComponent key={toast.id} toast={toast} onClose={onClose} />
    ))}
  </div>
);

// Toast Provider
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  const success = useCallback(
    (message: string, duration?: number) => {
      return addToast({ type: 'success', message, duration });
    },
    [addToast]
  );

  const error = useCallback(
    (message: string, duration?: number) => {
      return addToast({ type: 'error', message, duration: duration ?? 8000 });
    },
    [addToast]
  );

  const warning = useCallback(
    (message: string, duration?: number) => {
      return addToast({ type: 'warning', message, duration: duration ?? 6000 });
    },
    [addToast]
  );

  const info = useCallback(
    (message: string, duration?: number) => {
      return addToast({ type: 'info', message, duration });
    },
    [addToast]
  );

  return (
    <ToastContext.Provider
      value={{ toasts, addToast, removeToast, clearAll, success, error, warning, info }}
    >
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
};

// Hook
export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Simple standalone Toast (for use without provider)
export const Toast: React.FC<ToastProps> = ({ id, type, message, duration, onClose, action }) => {
  return (
    <ToastItemComponent
      toast={{ id, type, message, duration, action }}
      onClose={() => onClose(id)}
    />
  );
};

export default ToastProvider;
