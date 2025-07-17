import React from 'react';
import { useNotificationStore, Notification } from '../../stores/notificationStore';
import { designTokens } from '../../styles/designTokens';
import { useBreakpoint } from '../../hooks/useMediaQuery';
import { Button } from './Button';

export const NotificationCenter: React.FC = () => {
  const { notifications, removeNotification, clearAll } = useNotificationStore();
  const { isMobile } = useBreakpoint();

  if (notifications.length === 0) return null;

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    top: isMobile ? designTokens.spacing[4] : designTokens.spacing[6],
    right: isMobile ? designTokens.spacing[4] : designTokens.spacing[6],
    zIndex: designTokens.zIndex.toast,
    display: 'flex',
    flexDirection: 'column',
    gap: designTokens.spacing[3],
    maxWidth: isMobile ? 'calc(100vw - 32px)' : '400px',
    width: '100%',
  };

  return (
    <div style={containerStyle}>
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
      
      {notifications.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: designTokens.spacing[2] }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            style={{ fontSize: designTokens.typography.fontSize.xs }}
          >
            Clear All
          </Button>
        </div>
      )}
    </div>
  );
};

interface NotificationItemProps {
  notification: Notification;
  onClose: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onClose }) => {
  const getNotificationStyles = (type: Notification['type']) => {
    const baseStyle = {
      backgroundColor: designTokens.colors.neutral[0],
      border: '1px solid',
      borderRadius: designTokens.borderRadius.lg,
      padding: designTokens.spacing[4],
      boxShadow: designTokens.shadows.lg,
      display: 'flex',
      alignItems: 'flex-start',
      gap: designTokens.spacing[3],
      position: 'relative' as const,
      animation: 'slideInRight 0.3s ease-out',
      minWidth: '300px',
    };

    const typeStyles = {
      success: {
        borderColor: designTokens.colors.semantic.success[300],
        backgroundColor: designTokens.colors.semantic.success[50],
      },
      error: {
        borderColor: designTokens.colors.semantic.error[300],
        backgroundColor: designTokens.colors.semantic.error[50],
      },
      warning: {
        borderColor: designTokens.colors.semantic.warning[300],
        backgroundColor: designTokens.colors.semantic.warning[50],
      },
      info: {
        borderColor: designTokens.colors.semantic.info[300],
        backgroundColor: designTokens.colors.semantic.info[50],
      },
    };

    return { ...baseStyle, ...typeStyles[type] };
  };

  const getIcon = (type: Notification['type']) => {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
    };
    return icons[type];
  };

  const getIconColor = (type: Notification['type']) => {
    const colors = {
      success: designTokens.colors.semantic.success[600],
      error: designTokens.colors.semantic.error[600],
      warning: designTokens.colors.semantic.warning[600],
      info: designTokens.colors.semantic.info[600],
    };
    return colors[type];
  };

  const iconStyle: React.CSSProperties = {
    fontSize: '20px',
    color: getIconColor(notification.type),
    flexShrink: 0,
    marginTop: '2px',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: designTokens.spacing[1],
  };

  const titleStyle: React.CSSProperties = {
    fontSize: designTokens.typography.fontSize.sm,
    fontWeight: designTokens.typography.fontWeight.semibold,
    color: designTokens.colors.neutral[900],
    margin: 0,
  };

  const messageStyle: React.CSSProperties = {
    fontSize: designTokens.typography.fontSize.sm,
    color: designTokens.colors.neutral[700],
    margin: 0,
    lineHeight: designTokens.typography.lineHeight.normal,
  };

  const timestampStyle: React.CSSProperties = {
    fontSize: designTokens.typography.fontSize.xs,
    color: designTokens.colors.neutral[500],
    marginTop: designTokens.spacing[1],
  };

  const closeButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: designTokens.spacing[2],
    right: designTokens.spacing[2],
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    color: designTokens.colors.neutral[500],
    padding: designTokens.spacing[1],
    borderRadius: designTokens.borderRadius.sm,
    transition: `color ${designTokens.animation.duration.fast} ${designTokens.animation.easing.easeInOut}`,
  };

  const actionStyle: React.CSSProperties = {
    marginTop: designTokens.spacing[2],
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <div style={getNotificationStyles(notification.type)}>
      <span style={iconStyle}>{getIcon(notification.type)}</span>
      
      <div style={contentStyle}>
        <h4 style={titleStyle}>{notification.title}</h4>
        <p style={messageStyle}>{notification.message}</p>
        <div style={timestampStyle}>{formatTimestamp(notification.timestamp)}</div>
        
        {notification.action && (
          <div style={actionStyle}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                notification.action!.onClick();
                onClose();
              }}
            >
              {notification.action.label}
            </Button>
          </div>
        )}
      </div>

      <button
        style={closeButtonStyle}
        onClick={onClose}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = designTokens.colors.neutral[700];
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = designTokens.colors.neutral[500];
        }}
        title="Close notification"
      >
        ×
      </button>
    </div>
  );
};

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

export default NotificationCenter;