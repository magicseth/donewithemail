import React, { createContext, useContext, useRef, useCallback, RefObject } from "react";
import { View } from "react-native";
import ViewShot from "react-native-view-shot";

type ScreenshotContextType = {
  viewShotRef: RefObject<ViewShot | null>;
  captureScreenshot: () => Promise<string | null>;
};

const ScreenshotContext = createContext<ScreenshotContextType | null>(null);

export function ScreenshotProvider({ children }: { children: React.ReactNode }) {
  const viewShotRef = useRef<ViewShot | null>(null);

  const captureScreenshot = useCallback(async (): Promise<string | null> => {
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
  }, []);

  return (
    <ScreenshotContext.Provider value={{ viewShotRef, captureScreenshot }}>
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
    throw new Error("useScreenshot must be used within a ScreenshotProvider");
  }
  return context;
}
