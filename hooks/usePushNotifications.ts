/**
 * Web stub for push notifications.
 * Push notifications are only supported on native platforms.
 */
export function usePushNotifications() {
  // No-op function for web platform
  const dismissAllNotifications = async () => {
    // Push notifications not supported on web
  };

  return {
    expoPushToken: null,
    notification: null,
    dismissAllNotifications,
  };
}
