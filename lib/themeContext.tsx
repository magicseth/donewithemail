import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Platform, useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";

const THEME_STORAGE_KEY = "donewith_theme";

// Color definitions for each theme
export interface ThemeColors {
  // Backgrounds
  background: string;
  backgroundSecondary: string;
  card: string;

  // Text
  text: string;
  textSecondary: string;
  textTertiary: string;

  // Primary accent
  primary: string;
  primaryLight: string;

  // Borders
  border: string;
  borderLight: string;

  // Status colors
  success: string;
  error: string;
  warning: string;

  // Tab bar
  tabBar: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;

  // Header
  headerBackground: string;
  headerText: string;
}

export type ThemeName = "light" | "dark" | "midnight" | "ocean" | "forest" | "system";

const lightTheme: ThemeColors = {
  background: "#F5F5F5",
  backgroundSecondary: "#FFFFFF",
  card: "#FFFFFF",
  text: "#1a1a1a",
  textSecondary: "#666666",
  textTertiary: "#999999",
  primary: "#6366F1",
  primaryLight: "#E8EAFF",
  border: "#EEEEEE",
  borderLight: "#F3F4F6",
  success: "#10B981",
  error: "#EF4444",
  warning: "#FFA500",
  tabBar: "#FFFFFF",
  tabBarBorder: "#EEEEEE",
  tabBarActive: "#6366F1",
  tabBarInactive: "#999999",
  headerBackground: "#FFFFFF",
  headerText: "#1a1a1a",
};

const darkTheme: ThemeColors = {
  background: "#121212",
  backgroundSecondary: "#1E1E1E",
  card: "#1E1E1E",
  text: "#FFFFFF",
  textSecondary: "#A0A0A0",
  textTertiary: "#666666",
  primary: "#818CF8",
  primaryLight: "#2D2D5A",
  border: "#2D2D2D",
  borderLight: "#252525",
  success: "#34D399",
  error: "#F87171",
  warning: "#FBBF24",
  tabBar: "#1E1E1E",
  tabBarBorder: "#2D2D2D",
  tabBarActive: "#818CF8",
  tabBarInactive: "#666666",
  headerBackground: "#1E1E1E",
  headerText: "#FFFFFF",
};

const midnightTheme: ThemeColors = {
  background: "#0F0F23",
  backgroundSecondary: "#1A1A2E",
  card: "#1A1A2E",
  text: "#E4E4E7",
  textSecondary: "#9CA3AF",
  textTertiary: "#6B7280",
  primary: "#A78BFA",
  primaryLight: "#2E2654",
  border: "#27273F",
  borderLight: "#1F1F35",
  success: "#34D399",
  error: "#FB7185",
  warning: "#FCD34D",
  tabBar: "#1A1A2E",
  tabBarBorder: "#27273F",
  tabBarActive: "#A78BFA",
  tabBarInactive: "#6B7280",
  headerBackground: "#1A1A2E",
  headerText: "#E4E4E7",
};

const oceanTheme: ThemeColors = {
  background: "#F0F7FF",
  backgroundSecondary: "#FFFFFF",
  card: "#FFFFFF",
  text: "#0F172A",
  textSecondary: "#475569",
  textTertiary: "#94A3B8",
  primary: "#0EA5E9",
  primaryLight: "#E0F2FE",
  border: "#CBD5E1",
  borderLight: "#E2E8F0",
  success: "#10B981",
  error: "#EF4444",
  warning: "#F59E0B",
  tabBar: "#FFFFFF",
  tabBarBorder: "#CBD5E1",
  tabBarActive: "#0EA5E9",
  tabBarInactive: "#94A3B8",
  headerBackground: "#FFFFFF",
  headerText: "#0F172A",
};

const forestTheme: ThemeColors = {
  background: "#F0FDF4",
  backgroundSecondary: "#FFFFFF",
  card: "#FFFFFF",
  text: "#14532D",
  textSecondary: "#166534",
  textTertiary: "#86EFAC",
  primary: "#22C55E",
  primaryLight: "#DCFCE7",
  border: "#BBF7D0",
  borderLight: "#D1FAE5",
  success: "#10B981",
  error: "#EF4444",
  warning: "#F59E0B",
  tabBar: "#FFFFFF",
  tabBarBorder: "#BBF7D0",
  tabBarActive: "#22C55E",
  tabBarInactive: "#86EFAC",
  headerBackground: "#FFFFFF",
  headerText: "#14532D",
};

export const themes: Record<Exclude<ThemeName, "system">, ThemeColors> = {
  light: lightTheme,
  dark: darkTheme,
  midnight: midnightTheme,
  ocean: oceanTheme,
  forest: forestTheme,
};

export const themeDisplayNames: Record<ThemeName, string> = {
  system: "System Default",
  light: "Light",
  dark: "Dark",
  midnight: "Midnight",
  ocean: "Ocean",
  forest: "Forest",
};

interface ThemeContextType {
  themeName: ThemeName;
  colors: ThemeColors;
  setTheme: (theme: ThemeName) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

// Storage helpers that work on both web and native
const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        return localStorage.getItem(key);
      }
      return null;
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      console.error("[Theme] Failed to read storage:", e);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        localStorage.setItem(key, value);
      }
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      console.error("[Theme] Failed to write storage:", e);
    }
  },
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeName, setThemeName] = useState<ThemeName>("system");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved theme preference on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const stored = await storage.getItem(THEME_STORAGE_KEY);
        if (stored && (stored === "system" || stored in themes)) {
          setThemeName(stored as ThemeName);
        }
      } catch (e) {
        console.error("[Theme] Failed to load theme preference:", e);
      }
      setIsLoaded(true);
    };
    loadTheme();
  }, []);

  // Save theme preference when it changes
  const setTheme = useCallback(async (newTheme: ThemeName) => {
    setThemeName(newTheme);
    await storage.setItem(THEME_STORAGE_KEY, newTheme);
  }, []);

  // Resolve actual colors based on theme name (handle "system" option)
  const resolvedThemeName: Exclude<ThemeName, "system"> =
    themeName === "system"
      ? (systemColorScheme === "dark" ? "dark" : "light")
      : themeName;

  const colors = themes[resolvedThemeName];
  const isDark = resolvedThemeName === "dark" || resolvedThemeName === "midnight";

  // Don't render children until theme is loaded to prevent flash
  if (!isLoaded) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ themeName, colors, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
