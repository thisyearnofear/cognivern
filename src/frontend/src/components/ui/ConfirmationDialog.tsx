/** @jsxImportSource @emotion/react */
import React, { useEffect, useRef } from 'react';
import { css, keyframes } from '@emotion/react';
import { designTokens } from '../../styles/design-system';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Button } from './Button';

export type ConfirmType = 'danger' | 'warning' | 'info';

export interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: ConfirmType;
  confirmIcon?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  autoFocus?: 'confirm' | 'cancel';
}

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const scaleIn = keyframes`
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
`;

const typeConfig = {
  danger: {
    icon: Trash2,
    color: designTokens.colors.semantic.error[600],
    bg: designTokens.colors.semantic.error[50],
    border: designTokens.colors.semantic.error[200],
    confirmVariant: 'danger' as const,
  },
  warning: {
    icon: AlertTriangle,
    color: designTokens.colors.semantic.warning[600],
    bg: designTokens.colors.semantic.warning[50],
    border: designTokens.colors.semantic.warning[200],
    confirmVariant: 'primary' as const,
  },
  info: {
    icon: AlertTriangle,
    color: designTokens.colors.primary[600],
    bg: designTokens.colors.primary[50],
    border: designTokens.colors.primary[200],
    confirmVariant: 'primary' as const,
  },
};

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  type = 'danger',
  confirmIcon,
  onConfirm,
  onCancel,
  isLoading = false,
  autoFocus = 'cancel',
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const config = typeConfig[type];
  const Icon = config.icon;

  // Handle escape key and trap focus
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Focus management
    if (autoFocus === 'confirm' && confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    } else if (cancelButtonRef.current) {
      cancelButtonRef.current.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel, autoFocus]);

  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        css={css`
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          z-index: 9998;
          animation: ${fadeIn} 0.2s ease-out;
        `}
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        css={css`
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 9999;
          width: 90%;
          max-width: 420px;
          background: var(--bg-primary);
          border-radius: ${designTokens.borderRadius.xl};
          box-shadow: ${designTokens.shadows.xl};
          animation: ${scaleIn} 0.2s ease-out;
          overflow: hidden;
        `}
      >
        {/* Header */}
        <div
          css={css`
            display: flex;
            align-items: center;
            gap: ${designTokens.spacing[4]};
            padding: ${designTokens.spacing[5]};
            border-bottom: 1px solid var(--border-subtle);
          `}
        >
          {/* Icon */}
          <div
            css={css`
              display: flex;
              align-items: center;
              justify-content: center;
              width: 48px;
              height: 48px;
              border-radius: 50%;
              background: ${config.bg};
              color: ${config.color};
              flex-shrink: 0;
            `}
          >
            <Icon size={24} />
          </div>

          <div css={css`flex: 1;`}>
            <h2
              id="confirm-dialog-title"
              css={css`
                font-size: ${designTokens.typography.fontSize.lg};
                font-weight: ${designTokens.typography.fontWeight.semibold};
                color: var(--text-primary);
                margin: 0;
              `}
            >
              {title}
            </h2>
          </div>

          {/* Close button */}
          <button
            onClick={onCancel}
            css={css`
              padding: ${designTokens.spacing[2]};
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
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Message */}
        <div css={css`padding: ${designTokens.spacing[5]};`}>
          <p
            id="confirm-dialog-message"
            css={css`
              font-size: ${designTokens.typography.fontSize.sm};
              color: var(--text-secondary);
              line-height: 1.6;
              margin: 0;
            `}
          >
            {message}
          </p>
        </div>

        {/* Actions */}
        <div
          css={css`
            display: flex;
            gap: ${designTokens.spacing[3]};
            padding: ${designTokens.spacing[5]};
            background: var(--bg-secondary);
            border-top: 1px solid var(--border-subtle);
            justify-content: flex-end;
          `}
        >
          <Button
            ref={cancelButtonRef}
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmButtonRef}
            variant={config.confirmVariant}
            onClick={onConfirm}
            isLoading={isLoading}
            leftIcon={confirmIcon}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </>
  );
};

// Hook for managing confirmation dialogs
export function useConfirmation() {
  const [state, setState] = React.useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: ConfirmType;
    confirmLabel: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'danger',
    confirmLabel: 'Confirm',
  });

  const confirm = React.useCallback(
    (options: {
      title: string;
      message: string;
      type?: ConfirmType;
      confirmLabel?: string;
      onConfirm?: () => void;
      onCancel?: () => void;
    }) => {
      return new Promise<boolean>((resolve) => {
        setState({
          isOpen: true,
          title: options.title,
          message: options.message,
          type: options.type ?? 'danger',
          confirmLabel: options.confirmLabel ?? 'Confirm',
          onConfirm: () => {
            setState((s) => ({ ...s, isOpen: false }));
            options.onConfirm?.();
            resolve(true);
          },
          onCancel: () => {
            setState((s) => ({ ...s, isOpen: false }));
            options.onCancel?.();
            resolve(false);
          },
        });
      });
    },
    []
  );

  const dialog = state.isOpen ? (
    <ConfirmationDialog
      isOpen={state.isOpen}
      title={state.title}
      message={state.message}
      type={state.type}
      confirmLabel={state.confirmLabel}
      onConfirm={state.onConfirm!}
      onCancel={() => {
        setState((s) => ({ ...s, isOpen: false }));
        state.onCancel?.();
      }}
    />
  ) : null;

  return { confirm, dialog };
}

export default ConfirmationDialog;
