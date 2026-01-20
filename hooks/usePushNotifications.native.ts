import { useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useMutation, useConvexAuth } from "convex/react";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { api } from "../convex/_generated/api";

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<any | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<{ type: string; emailId?: string } | null>(null);
  const notificationListener = useRef<any | null>(null);
  const responseListener = useRef<any | null>(null);

  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const registerToken = useMutation(api.notifications.registerMyPushToken);

  // Process pending navigation once auth is ready
  useEffect(() => {
    if (isAuthenticated && !isLoading && pendingNavigation) {
      const data = pendingNavigation;
      console.log("[Push] Auth ready, processing pending navigation:", data);
      setPendingNavigation(null);

      setTimeout(() => {
        if (data.type === "missed_todos") {
          router.navigate("/(tabs)");
        } else if (data.emailId) {
          router.push(`/email/${data.emailId}`);
        }
      }, 100);
    }
  }, [isAuthenticated, isLoading, pendingNavigation, router]);

  useEffect(() => {
    let registrationFailed = false;

    const attemptRegistration = async () => {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        setExpoPushToken(token);
        registrationFailed = false;
      } else {
        registrationFailed = true;
      }
    };

    // Initial registration attempt
    attemptRegistration();

    // Retry when app comes back to foreground (user unlocked phone)
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active" && registrationFailed) {
        console.log("[Push] App became active, retrying registration...");
        attemptRegistration();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    // Check if app was launched from a notification (app was closed)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const data = response.notification.request.content.data;
        console.log("[Push] App launched from notification:", data);
        // Store for later - will be processed once auth is ready
        setPendingNavigation({
          type: data?.type || "email",
          emailId: data?.emailId,
        });
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
        console.log("[Push] Notification tapped:", data);

        // Store navigation intent - will be processed immediately if auth is ready,
        // or once auth becomes ready
        setPendingNavigation({
          type: data?.type || "email",
          emailId: data?.emailId,
        });
      }
    );

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
      subscription.remove();
    };
  }, [router]);

  // Register token with backend when Convex auth is ready
  useEffect(() => {
    // Only register when we have both the push token and Convex auth is ready
    if (expoPushToken && isAuthenticated && !isLoading) {
      registerToken({
        pushToken: expoPushToken,
      }).catch((err) => {
        console.error("Failed to register push token:", err);
      });
    }
  }, [expoPushToken, isAuthenticated, isLoading, registerToken]);

  return {
    expoPushToken,
    notification,
  };
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
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
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const token = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    return token.data;
  } catch (error) {
    // Handle keychain access errors (common on iOS Simulator or when keychain is locked)
    console.log("Push notification registration failed (this is normal on Simulator):", error);
    return null;
  }
}
