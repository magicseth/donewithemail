import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { api } from "../convex/_generated/api";
import { useAuth } from "../lib/authContext";

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const registerToken = useMutation(api.notifications.registerPushToken);

  useEffect(() => {
    // Only run on native platforms
    if (Platform.OS === "web") return;

    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        setExpoPushToken(token);
      }
    });

    // Check if app was launched from a notification (app was closed)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const data = response.notification.request.content.data;
        console.log("App launched from notification:", data);
        // Small delay to ensure navigation is ready
        setTimeout(() => {
          if (data?.type === "missed_todos") {
            // Navigate to TODO tab (index)
            router.navigate("/(tabs)");
          } else if (data?.emailId) {
            router.push(`/email/${data.emailId}`);
          }
        }, 100);
      }
    });

    // Listen for notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        setNotification(notification);
      }
    );

    // Listen for user interactions with notifications (app in background or foreground)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        console.log("Notification tapped:", data);

        // Handle different notification types
        if (data?.type === "missed_todos") {
          // Navigate to TODO tab (index)
          router.navigate("/(tabs)");
        } else if (data?.emailId) {
          // Navigate to the specific email
          router.push(`/email/${data.emailId}`);
        }
      }
    );

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [router]);

  // Register token with backend when user is authenticated
  useEffect(() => {
    if (expoPushToken && isAuthenticated && user?.email) {
      registerToken({
        pushToken: expoPushToken,
        userEmail: user.email,
      }).catch((err) => {
        console.error("Failed to register push token:", err);
      });
    }
  }, [expoPushToken, isAuthenticated, user?.email, registerToken]);

  return {
    expoPushToken,
    notification,
  };
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not already granted
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push notification permission not granted");
    return null;
  }

  // Get the Expo push token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const token = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    return token.data;
  } catch (error) {
    console.error("Failed to get push token:", error);
    return null;
  }
}
