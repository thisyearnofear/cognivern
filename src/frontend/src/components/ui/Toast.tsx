/** @jsxImportSource @emotion/react */
import React, { useEffect, useState } from 'react';
import { toastStyles, designTokens } from '../../styles/design-system';
import { css, keyframes } from '@emotion/react';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

const slideIn = keyframes`
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
`;

const slideOut = keyframes`
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(100%); opacity: 0; }
`;

const iconConfig = {
  success: { Icon: CheckCircle, color: designTokens.colors.semantic.success[600] },
  error: { Icon: XCircle, color: designTokens.colors.semantic.error[600] },
  warning: { Icon: AlertTriangle, color: designTokens.colors.semantic.warning[600] },
  info: { Icon: Info, color: designTokens.colors.semantic.info[600] },
};

export interface ToastProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  onClose: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const Toast: React.FC<ToastProps> = ({
  type,
  message,
  duration = 5000,
  onClose,
  action,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const toastRef = React.useRef<HTMLDivElement>(null);
  const { Icon, color } = iconConfig[type];

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => handleClose(), duration);
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    onClose();
  };

  return (
    <div
      ref={toastRef}
      css={css`
        ${toastStyles.item(type)};
        animation: ${isVisible && !isExiting ? slideIn : slideOut} 0.3s ease-out forwards;
      `}
      role="alert"
      aria-live="polite"
    >
      <span css={toastStyles.icon(type)}>
        <Icon size={20} color={color} />
      </span>

      <div css={toastStyles.content}>
        <p css={toastStyles.message}>{message}</p>

        {action && (
          <div css={toastStyles.actions}>
            <button css={toastStyles.actionButton} onClick={action.onClick}>
              {action.label}
            </button>
          </div>
        )}
      </div>

      <button css={toastStyles.closeButton} onClick={handleClose} aria-label="Close notification">
        <X size={16} />
      </button>
    </div>
  );
};

export default Toast;
