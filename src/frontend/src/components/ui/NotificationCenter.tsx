import React from 'react';
import { useNotificationStore, Notification } from '../../stores/notificationStore';

import { useBreakpoint } from '../../hooks/useMediaQuery';
import { Button } from './Button';
import {
  getNotificationContainerStyles,
  getNotificationItemStyles,
  getNotificationIconStyles,
  notificationContentStyles,
  notificationTitleStyles,
  notificationMessageStyles,
  notificationTimestampStyles,
  notificationCloseButtonStyles,
  notificationActionStyles,
  notificationClearAllButtonContainerStyles,
} from '../../styles/styles';

export const NotificationCenter: React.FC = () => {
  const { notifications, removeNotification, clearAll } = useNotificationStore();
  const { isMobile } = useBreakpoint();

  if (notifications.length === 0) return null;

  return (
    <div css={getNotificationContainerStyles(isMobile)}>
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
      
      {notifications.length > 1 && (
        <div css={notificationClearAllButtonContainerStyles}>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            css={{
              fontSize: designTokens.typography.fontSize.xs,
            }}
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
  const getIcon = (type: Notification['type']) => {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
    };
    return icons[type];
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
    <div css={getNotificationItemStyles(notification.type)}>
      <span css={getNotificationIconStyles(notification.type)}>{getIcon(notification.type)}</span>
      
      <div css={notificationContentStyles}>
        <h4 css={notificationTitleStyles}>{notification.title}</h4>
        <p css={notificationMessageStyles}>{notification.message}</p>
        <div css={notificationTimestampStyles}>{formatTimestamp(notification.timestamp)}</div>
        
        {notification.action && (
          <div css={notificationActionStyles}>
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
        css={notificationCloseButtonStyles}
        onClick={onClose}
        title="Close notification"
      >
        ×
      </button>
    </div>
  );
};

export default NotificationCenter;