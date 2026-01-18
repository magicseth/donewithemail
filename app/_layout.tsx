import { Stack } from "expo-router";
import { ConvexReactClient, ConvexProvider } from "convex/react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet } from "react-native";
import { AuthProvider } from "../lib/authContext";

// Initialize Convex client
const convex = new ConvexReactClient(
  process.env.EXPO_PUBLIC_CONVEX_URL || "https://your-deployment.convex.cloud"
);

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <ConvexProvider client={convex}>
        <AuthProvider>
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
        </AuthProvider>
      </ConvexProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
