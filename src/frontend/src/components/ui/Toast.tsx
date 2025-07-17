import React, { useEffect, useState } from 'react';
import { designTokens } from '../../styles/designTokens';

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

const toastVariants = {
  success: {
    backgroundColor: designTokens.colors.semantic.success[50],
    borderColor: designTokens.colors.semantic.success[200],
    color: designTokens.colors.semantic.success[800],
    icon: '✅',
  },
  error: {
    backgroundColor: designTokens.colors.semantic.error[50],
    borderColor: designTokens.colors.semantic.error[200],
    color: designTokens.colors.semantic.error[800],
    icon: '❌',
  },
  warning: {
    backgroundColor: designTokens.colors.semantic.warning[50],
    borderColor: designTokens.colors.semantic.warning[200],
    color: designTokens.colors.semantic.warning[800],
    icon: '⚠️',
  },
  info: {
    backgroundColor: designTokens.colors.semantic.info[50],
    borderColor: designTokens.colors.semantic.info[200],
    color: designTokens.colors.semantic.info[800],
    icon: 'ℹ️',
  },
};

export const Toast: React.FC<ToastProps> = ({
  type,
  message,
  duration = 5000,
  onClose,
  action,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

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
    setTimeout(() => {
      onClose();
    }, 300); // Match animation duration
  };

  const variant = toastVariants[type];

  const toastStyle: React.CSSProperties = {
    position: 'fixed',
    top: designTokens.spacing[6],
    right: designTokens.spacing[6],
    zIndex: designTokens.zIndex.toast,
    backgroundColor: variant.backgroundColor,
    border: `1px solid ${variant.borderColor}`,
    color: variant.color,
    borderRadius: designTokens.borderRadius.lg,
    padding: designTokens.spacing[4],
    boxShadow: designTokens.shadows.lg,
    maxWidth: '400px',
    minWidth: '300px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: designTokens.spacing[3],
    transform: isVisible && !isExiting ? 'translateX(0)' : 'translateX(100%)',
    opacity: isVisible && !isExiting ? 1 : 0,
    transition: `all ${designTokens.animation.duration.slow} ${designTokens.animation.easing.easeInOut}`,
    fontFamily: designTokens.typography.fontFamily.sans.join(', '),
  };

  const iconStyle: React.CSSProperties = {
    fontSize: '20px',
    flexShrink: 0,
    marginTop: '2px',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: designTokens.spacing[2],
  };

  const messageStyle: React.CSSProperties = {
    fontSize: designTokens.typography.fontSize.sm,
    lineHeight: designTokens.typography.lineHeight.normal,
    margin: 0,
  };

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: designTokens.spacing[2],
    marginTop: designTokens.spacing[2],
  };

  const actionButtonStyle: React.CSSProperties = {
    background: 'none',
    border: `1px solid ${variant.borderColor}`,
    color: variant.color,
    padding: `${designTokens.spacing[1]} ${designTokens.spacing[3]}`,
    borderRadius: designTokens.borderRadius.sm,
    fontSize: designTokens.typography.fontSize.xs,
    fontWeight: designTokens.typography.fontWeight.medium,
    cursor: 'pointer',
    transition: `all ${designTokens.animation.duration.fast} ${designTokens.animation.easing.easeInOut}`,
  };

  const closeButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: variant.color,
    cursor: 'pointer',
    padding: designTokens.spacing[1],
    borderRadius: designTokens.borderRadius.sm,
    fontSize: '16px',
    lineHeight: 1,
    opacity: 0.7,
    transition: `opacity ${designTokens.animation.duration.fast} ${designTokens.animation.easing.easeInOut}`,
  };

  return (
    <div style={toastStyle}>
      <span style={iconStyle}>{variant.icon}</span>
      
      <div style={contentStyle}>
        <p style={messageStyle}>{message}</p>
        
        {action && (
          <div style={actionsStyle}>
            <button
              style={actionButtonStyle}
              onClick={action.onClick}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              {action.label}
            </button>
          </div>
        )}
      </div>

      <button
        style={closeButtonStyle}
        onClick={handleClose}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.7';
        }}
        title="Close notification"
      >
        ×
      </button>
    </div>
  );
};

export default Toast;