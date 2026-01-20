import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";

// Simple icon components (replace with proper icons later)
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const iconMap: Record<string, string> = {
    todos: "📋",
    inbox: "📥",
    settings: "⚙️",
    ask: "💬",
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
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#6366F1",
        tabBarInactiveTintColor: "#999",
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        headerShown: true,
        headerStyle: styles.header,
        headerTitleStyle: styles.headerTitle,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Donebox",
          tabBarIcon: ({ focused }) => <TabIcon name="inbox" focused={focused} />,
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
