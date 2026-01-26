import React, { useState, useEffect } from "react";
import { Platform, StyleSheet, ViewStyle, View, Text } from "react-native";

interface WebViewWrapperProps {
  html: string;
  style?: ViewStyle;
}

// Lazy-loaded WebView component for native platforms
let NativeWebView: React.ComponentType<any> | null = null;

export function WebViewWrapper({ html, style }: WebViewWrapperProps) {
  const [WebViewComponent, setWebViewComponent] = useState<React.ComponentType<any> | null>(
    NativeWebView
  );

  useEffect(() => {
    // Only load WebView on native platforms
    if (Platform.OS !== "web" && !NativeWebView) {
      try {
        const { WebView } = require("react-native-webview");
        NativeWebView = WebView;
        setWebViewComponent(() => WebView);
      } catch (e) {
        console.warn("Failed to load WebView:", e);
      }
    }
  }, []);

  // Web: render iframe that fills remaining viewport space
  // Use 70vh as minHeight to ensure the iframe is large enough to show email content
  // while still being scrollable if the page has other content above
  if (Platform.OS === "web") {
    return (
      <iframe
        srcDoc={html}
        style={{
          width: "100%",
          minHeight: "70vh",
          border: "1px solid #eee",
          borderRadius: 8,
          backgroundColor: "#fff",
        }}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-scripts"
      />
    );
  }

  // Native: render WebView (lazy loaded)
  if (!WebViewComponent) {
    return (
      <View style={[styles.webView, style]}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <WebViewComponent
      originWhitelist={["*"]}
      source={{ html }}
      style={[styles.webView, style]}
      scrollEnabled={true}
      nestedScrollEnabled={true}
      showsVerticalScrollIndicator={true}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      allowFileAccess={true}
    />
  );
}

const styles = StyleSheet.create({
  webView: {
    flex: 1,
    minHeight: 400,
    backgroundColor: "#fff",
  },
});
