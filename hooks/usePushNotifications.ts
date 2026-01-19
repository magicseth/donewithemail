/**
 * Web stub for push notifications.
 * Push notifications are only supported on native platforms.
 */
export function usePushNotifications() {
  return {
    expoPushToken: null,
    notification: null,
  };
}
