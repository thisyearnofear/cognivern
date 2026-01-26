import { create } from "zustand";

export interface Notification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  persistent?: boolean;
  timestamp: number;
}

interface NotificationState {
  notifications: Notification[];
  maxNotifications: number;

  // Actions
  addNotification: (
    notification: Omit<Notification, "id" | "timestamp">,
  ) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  markAsRead: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  maxNotifications: 5,

  addNotification: (notification) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: Date.now(),
      duration:
        notification.duration ?? (notification.type === "error" ? 0 : 5000), // Errors persist by default
    };

    set((state) => {
      const notifications = [newNotification, ...state.notifications];

      // Limit the number of notifications
      if (notifications.length > state.maxNotifications) {
        notifications.splice(state.maxNotifications);
      }

      return { notifications };
    });

    // Auto-remove notification after duration (if not persistent)
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        get().removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearAll: () => {
    set({ notifications: [] });
  },

  markAsRead: (id) => {
    // For future implementation of read/unread states
    console.log("Marking notification as read:", id);
  },
}));

// Utility functions for common notification types
export const useNotifications = () => {
  const { addNotification, removeNotification, clearAll } =
    useNotificationStore();

  return {
    success: (
      title: string,
      message: string,
      options?: Partial<Notification>,
    ) => addNotification({ type: "success", title, message, ...options }),

    error: (title: string, message: string, options?: Partial<Notification>) =>
      addNotification({ type: "error", title, message, ...options }),

    warning: (
      title: string,
      message: string,
      options?: Partial<Notification>,
    ) => addNotification({ type: "warning", title, message, ...options }),

    info: (title: string, message: string, options?: Partial<Notification>) =>
      addNotification({ type: "info", title, message, ...options }),

    remove: removeNotification,
    clearAll,
  };
};
