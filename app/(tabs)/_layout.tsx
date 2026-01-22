import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { useAuth } from "../../lib/authContext";
import { useDemoMode } from "../../lib/demoModeContext";
import { useTheme } from "../../lib/themeContext";
import { SignInScreen } from "../../components/SignInScreen";
import { AddFeatureButton } from "../../components/AddFeatureButton";

// Signal for inbox tab press - used to close category only on explicit tab re-tap
// Module-level to avoid re-render coordination issues
let inboxTabPressSignal = 0;
export function getInboxTabPressSignal() {
  return inboxTabPressSignal;
}

// Track whether inbox is currently focused - used to detect re-taps vs initial navigation
let isInboxFocused = false;
export function setInboxFocused(focused: boolean) {
  isInboxFocused = focused;
}

// Simple icon components (replace with proper icons later)
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const iconMap: Record<string, string> = {
    todos: "📋",
    inbox: "📥",
    settings: "⚙️",
    ask: "💬",
    debug: "🔍",
  };

  return (
    <View style={styles.iconContainer}>
      <Text style={[styles.icon, focused && styles.iconFocused]}>
        {iconMap[name] || "📧"}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const { isDemoMode } = useDemoMode();
  const { colors } = useTheme();

  // Show sign-in screen when not authenticated and not in demo mode
  if (!isLoading && !isAuthenticated && !isDemoMode) {
    return <SignInScreen />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: [styles.tabBar, { backgroundColor: colors.tabBar, borderTopColor: colors.tabBarBorder }],
        tabBarLabelStyle: styles.tabLabel,
        headerShown: true,
        headerStyle: [styles.header, { backgroundColor: colors.headerBackground, borderBottomColor: colors.border }],
        headerTitleStyle: [styles.headerTitle, { color: colors.headerText }],
        headerRight: () => <AddFeatureButton />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inbox",
          tabBarIcon: ({ focused }) => <TabIcon name="inbox" focused={focused} />,
        }}
        listeners={{
          tabPress: () => {
            // Only increment signal if inbox is already focused (re-tap)
            // This allows category to close on re-tap but not when switching from another tab
            if (isInboxFocused) {
              inboxTabPressSignal++;
            }
          },
        }}
      />
      <Tabs.Screen
        name="todos"
        options={{
          title: "TODOs",
          headerTitle: "TODOs",
          tabBarIcon: ({ focused }) => <TabIcon name="todos" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="ask"
        options={{
          title: "Ask",
          headerTitle: "Ask My Email",
          tabBarIcon: ({ focused }) => <TabIcon name="ask" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="settings" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="debug"
        options={{
          title: "Debug",
          headerTitle: "Debug: All Emails",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="debug" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 8,
    paddingBottom: 8,
    height: 60,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  header: {
    backgroundColor: "#fff",
    shadowColor: "transparent",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: 24,
    opacity: 0.6,
  },
  iconFocused: {
    opacity: 1,
  },
});
