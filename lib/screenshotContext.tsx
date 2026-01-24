import React, { createContext, useContext, useRef, useCallback, RefObject, useState, useEffect } from "react";
import { View, Platform } from "react-native";

// Dynamically import ViewShot to handle missing native module gracefully
let ViewShot: any = null;
let viewShotAvailable = false;

try {
  // Only try to import on native platforms
  if (Platform.OS !== "web") {
    ViewShot = require("react-native-view-shot").default;
    viewShotAvailable = true;
  }
} catch (error) {
  console.warn("[Screenshot] react-native-view-shot not available:", error);
  viewShotAvailable = false;
}

type ScreenshotContextType = {
  viewShotRef: RefObject<any>;
  captureScreenshot: () => Promise<string | null>;
  isAvailable: boolean;
};

const ScreenshotContext = createContext<ScreenshotContextType | null>(null);

export function ScreenshotProvider({ children }: { children: React.ReactNode }) {
  const viewShotRef = useRef<any>(null);
  const [isAvailable, setIsAvailable] = useState(viewShotAvailable);

  const captureScreenshot = useCallback(async (): Promise<string | null> => {
    if (!isAvailable) {
      console.warn("[Screenshot] ViewShot not available on this platform/build");
      return null;
    }

    if (!viewShotRef.current) {
      console.warn("[Screenshot] ViewShot ref not available");
      return null;
    }

    try {
      // Capture as base64 data URI for cross-platform compatibility
      const uri = await viewShotRef.current.capture?.();
      if (uri) {
        console.log("[Screenshot] Captured successfully");
        return uri;
      }
      return null;
    } catch (error) {
      console.error("[Screenshot] Capture failed:", error);
      return null;
    }
  }, [isAvailable]);

  // If ViewShot is not available, just render children directly
  if (!isAvailable || !ViewShot) {
    return (
      <ScreenshotContext.Provider value={{ viewShotRef, captureScreenshot, isAvailable: false }}>
        <View style={{ flex: 1 }}>
          {children}
        </View>
      </ScreenshotContext.Provider>
    );
  }

  return (
    <ScreenshotContext.Provider value={{ viewShotRef, captureScreenshot, isAvailable: true }}>
      <ViewShot
        ref={viewShotRef}
        style={{ flex: 1 }}
        options={{ format: "png", quality: 0.8 }}
      >
        {children}
      </ViewShot>
    </ScreenshotContext.Provider>
  );
}

export function useScreenshot() {
  const context = useContext(ScreenshotContext);
  if (!context) {
    // Return a safe fallback instead of throwing
    return {
      viewShotRef: { current: null },
      captureScreenshot: async () => null,
      isAvailable: false,
    };
  }
  return context;
}
