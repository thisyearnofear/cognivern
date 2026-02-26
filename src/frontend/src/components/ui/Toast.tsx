import React, { useEffect, useState } from "react";
import { toastStyles } from "../../styles/design-system";
import { css } from "@emotion/react";
import { keyframes } from "@emotion/react";

const slideIn = keyframes`
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
`;

const slideOut = keyframes`
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(100%); opacity: 0; }
`;

export interface ToastProps {
  type: "success" | "error" | "warning" | "info";
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

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
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
        animation: ${isVisible && !isExiting ? slideIn : slideOut} 0.3s ease-out
          forwards;
      `}
      role="alert"
    >
      <span css={toastStyles.icon(type)}>{toastVariants[type].icon}</span>

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

      <button
        css={toastStyles.closeButton}
        onClick={handleClose}
        title="Close notification"
      >
        ×
      </button>
    </div>
  );
};

const toastVariants = {
  success: {
    icon: "✅",
  },
  error: {
    icon: "❌",
  },
  warning: {
    icon: "⚠️",
  },
  info: {
    icon: "ℹ️",
  },
};

export default Toast;
