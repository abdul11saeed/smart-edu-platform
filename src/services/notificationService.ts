// Firebase service for notifications
import { database } from '../firebase/config';
import { ref, set, push, get, onValue, update } from 'firebase/database';

export type NotificationType = 'private_message' | 'discussion_reply' | 'like' | 'message_edited' | 'message_deleted' | 'chat_request' | 'chat_request_accepted';

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    body: string;
    fromUserId: string;
    fromUserName: string;
    toUserId: string;
    link?: string;
    read: boolean;
    createdAt: number;
}

const NOTIFICATIONS_REF = 'notifications';

/**
 * Create a new notification
 */
export const createNotification = async (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>): Promise<Notification> => {
    const notificationsRef = ref(database, NOTIFICATIONS_REF);
    const newNotificationRef = push(notificationsRef);
    const notificationId = newNotificationRef.key || Date.now().toString();

    const newNotification: Notification = {
        ...notification,
        id: notificationId,
        read: false,
        createdAt: Date.now()
    };

    await set(newNotificationRef, newNotification);
    return newNotification;
};

/**
 * Get notifications for a specific user
 */
export const getUserNotifications = async (userId: string, limit: number = 20): Promise<Notification[]> => {
    const notificationsRef = ref(database, NOTIFICATIONS_REF);
    const snapshot = await get(notificationsRef);

    if (snapshot.exists()) {
        const notifications: Notification[] = [];
        snapshot.forEach((childSnapshot) => {
            const notification = childSnapshot.val() as Notification;
            if (notification.toUserId === userId) {
                notifications.push({
                    ...notification,
                    id: childSnapshot.key || notification.id
                });
            }
        });
        // Sort by createdAt descending
        return notifications.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
    }
    return [];
};

/**
 * Subscribe to real-time notifications for a user
 */
export const subscribeToUserNotifications = (
    userId: string,
    callback: (notifications: Notification[]) => void
): (() => void) => {
    const notificationsRef = ref(database, NOTIFICATIONS_REF);

    const unsubscribe = onValue(notificationsRef, (snapshot) => {
        if (snapshot.exists()) {
            const notifications: Notification[] = [];
            snapshot.forEach((childSnapshot) => {
                const notification = childSnapshot.val() as Notification;
                if (notification.toUserId === userId) {
                    notifications.push({
                        ...notification,
                        id: childSnapshot.key || notification.id
                    });
                }
            });
            // Sort by createdAt descending
            callback(notifications.sort((a, b) => b.createdAt - a.createdAt));
        } else {
            callback([]);
        }
    });

    return () => unsubscribe();
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
    const notificationRef = ref(database, `${NOTIFICATIONS_REF}/${notificationId}`);
    await update(notificationRef, { read: true });
};

/**
 * Get unread notification count for a user
 */
export const getUnreadNotificationCount = async (userId: string): Promise<number> => {
    const notifications = await getUserNotifications(userId, 50);
    return notifications.filter(n => !n.read).length;
};
