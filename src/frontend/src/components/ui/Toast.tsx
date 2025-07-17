import React, { useEffect, useState } from 'react';
import {
  toastContainerStyles,
  getToastItemStyles,
  getToastIconStyles,
  toastContentStyles,
  toastMessageStyles,
  toastActionsStyles,
  toastActionButtonStyles,
  toastCloseButtonStyles,
  toastInAnimation,
  toastOutAnimation,
} from '../../styles/styles';
import { css } from '@emotion/react';

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
    if (toastRef.current) {
      toastRef.current.style.animation = `${toastOutAnimation} 0.3s ease-out forwards`;
      toastRef.current.addEventListener('animationend', onClose, { once: true });
    } else {
      onClose();
    }
  };

  return (
    <div
      ref={toastRef}
      css={css`
        ${getToastItemStyles(type)};
        animation: ${isVisible && !isExiting ? toastInAnimation : toastOutAnimation} 0.3s ease-out forwards;
      `}
      role="alert"
    >
      <span css={getToastIconStyles(type)}>{toastVariants[type].icon}</span>
      
      <div css={toastContentStyles}>
        <p css={toastMessageStyles}>{message}</p>
        
        {action && (
          <div css={toastActionsStyles}>
            <button
              css={toastActionButtonStyles}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          </div>
        )}
      </div>

      <button
        css={toastCloseButtonStyles}
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
    icon: '✅',
  },
  error: {
    icon: '❌',
  },
  warning: {
    icon: '⚠️',
  },
  info: {
    icon: 'ℹ️',
  },
};

export default Toast;