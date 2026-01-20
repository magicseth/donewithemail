import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../lib/authContext";

export function SignInScreen() {
  const { isLoading, signIn } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top decorative element */}
      <View style={styles.topDecoration}>
        <View style={styles.circle1} />
        <View style={styles.circle2} />
        <View style={styles.circle3} />
      </View>

      {/* Main content */}
      <View style={styles.content}>
        {/* Logo/Icon area */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoIcon}>✓</Text>
          </View>
        </View>

        {/* App name and tagline */}
        <Text style={styles.appName}>donewith</Text>
        <Text style={styles.tagline}>Your inbox, simplified.</Text>

        {/* Features list */}
        <View style={styles.features}>
          <FeatureItem
            icon="✨"
            title="AI-Powered Triage"
            description="Smart summaries and urgency scoring"
          />
          <FeatureItem
            icon="⚡"
            title="Swipe to Action"
            description="Archive, reply, or delegate in one gesture"
          />
          <FeatureItem
            icon="🔔"
            title="Smart Notifications"
            description="Only get notified for what matters"
          />
        </View>

        {/* Sign in button */}
        <TouchableOpacity
          style={styles.signInButton}
          onPress={signIn}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <View style={styles.googleIcon}>
                <Text style={styles.googleIconText}>G</Text>
              </View>
              <Text style={styles.signInButtonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Privacy note */}
        <Text style={styles.privacyNote}>
          We only read your emails to provide summaries.{"\n"}
          Your data is never shared.
        </Text>
      </View>

      {/* Bottom padding for safe area */}
      <View style={{ paddingBottom: insets.bottom + 16 }} />
    </View>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIcon}>
        <Text style={styles.featureIconText}>{icon}</Text>
      </View>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FF",
  },
  topDecoration: {
    position: "absolute",
    top: -100,
    right: -50,
    width: 300,
    height: 300,
  },
  circle1: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(99, 102, 241, 0.1)",
    top: 0,
    right: 0,
  },
  circle2: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    top: 80,
    right: 60,
  },
  circle3: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(99, 102, 241, 0.08)",
    top: 40,
    right: 150,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#6366F1",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: "0 8px 32px rgba(99, 102, 241, 0.3)",
      },
    }),
  },
  logoIcon: {
    fontSize: 40,
    color: "#fff",
    fontWeight: "700",
  },
  appName: {
    fontSize: 36,
    fontWeight: "700",
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 8,
  },
  tagline: {
    fontSize: 18,
    color: "#666",
    textAlign: "center",
    marginBottom: 48,
  },
  features: {
    marginBottom: 48,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
      },
    }),
  },
  featureIconText: {
    fontSize: 22,
  },
  featureText: {
    flex: 1,
    marginLeft: 16,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 14,
    color: "#666",
  },
  signInButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6366F1",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: "#6366F1",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: "0 4px 16px rgba(99, 102, 241, 0.3)",
      },
    }),
  },
  googleIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  googleIconText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6366F1",
  },
  signInButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  privacyNote: {
    marginTop: 24,
    fontSize: 13,
    color: "#999",
    textAlign: "center",
    lineHeight: 20,
  },
});
