import { Stack } from "expo-router";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet } from "react-native";

// Initialize Convex client
// In production, use environment variable
const convex = new ConvexReactClient(
  process.env.EXPO_PUBLIC_CONVEX_URL || "https://your-deployment.convex.cloud"
);

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <ConvexProvider client={convex}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="email/[id]"
            options={{
              presentation: "card",
              headerShown: true,
              headerTitle: "Email",
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="person/[id]"
            options={{
              presentation: "card",
              headerShown: true,
              headerTitle: "Contact",
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="compose"
            options={{
              presentation: "modal",
              headerShown: true,
              headerTitle: "Compose",
            }}
          />
        </Stack>
      </ConvexProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
