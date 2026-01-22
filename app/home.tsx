import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useRouter, Link } from "expo-router";

export default function HomePage() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>DoneWith</Text>
          <View style={styles.headerLinks}>
            <Link href="/privacy" style={styles.headerLink}>
              <Text style={styles.headerLinkText}>Privacy</Text>
            </Link>
            <Link href="/terms" style={styles.headerLink}>
              <Text style={styles.headerLinkText}>Terms</Text>
            </Link>
          </View>
        </View>

        {/* Hero Section */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Email triage,{"\n"}done with AI</Text>
          <Text style={styles.heroSubtitle}>
            DoneWith is an AI-powered email app that helps you quickly process your
            inbox with TikTok-style swiping. Get summaries, urgency scores, and smart
            replies in seconds.
          </Text>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => router.push("/(tabs)")}
          >
            <Text style={styles.ctaButtonText}>Get Started</Text>
          </TouchableOpacity>
        </View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Features</Text>

          <View style={styles.featureGrid}>
            <View style={styles.featureCard}>
              <Text style={styles.featureIcon}>⚡</Text>
              <Text style={styles.featureTitle}>AI Summaries</Text>
              <Text style={styles.featureDescription}>
                Get instant summaries of long emails. Know what's important without
                reading every word.
              </Text>
            </View>

            <View style={styles.featureCard}>
              <Text style={styles.featureIcon}>🎯</Text>
              <Text style={styles.featureTitle}>Urgency Scoring</Text>
              <Text style={styles.featureDescription}>
                AI analyzes each email and assigns an urgency score so you know what
                needs attention first.
              </Text>
            </View>

            <View style={styles.featureCard}>
              <Text style={styles.featureIcon}>👆</Text>
              <Text style={styles.featureTitle}>Swipe to Triage</Text>
              <Text style={styles.featureDescription}>
                Swipe through emails like social media. Archive, flag for reply, or
                delegate with a gesture.
              </Text>
            </View>

            <View style={styles.featureCard}>
              <Text style={styles.featureIcon}>💬</Text>
              <Text style={styles.featureTitle}>Quick Replies</Text>
              <Text style={styles.featureDescription}>
                AI suggests contextual replies. Tap to send or customize before
                responding.
              </Text>
            </View>

            <View style={styles.featureCard}>
              <Text style={styles.featureIcon}>📋</Text>
              <Text style={styles.featureTitle}>TODO Tracking</Text>
              <Text style={styles.featureDescription}>
                Emails that need replies are tracked in your TODO list so nothing
                falls through the cracks.
              </Text>
            </View>

            <View style={styles.featureCard}>
              <Text style={styles.featureIcon}>📧</Text>
              <Text style={styles.featureTitle}>Multi-Account</Text>
              <Text style={styles.featureDescription}>
                Connect multiple Gmail accounts and manage them all from one
                unified inbox.
              </Text>
            </View>
          </View>
        </View>

        {/* How It Works Section */}
        <View style={styles.howItWorksSection}>
          <Text style={styles.sectionTitle}>How It Works</Text>

          <View style={styles.stepsList}>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Connect Gmail</Text>
                <Text style={styles.stepDescription}>
                  Sign in with Google and grant DoneWith permission to access your
                  inbox. Your credentials are never stored.
                </Text>
              </View>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>AI Analyzes</Text>
                <Text style={styles.stepDescription}>
                  Our AI reads your emails and generates summaries, urgency scores,
                  and smart reply suggestions.
                </Text>
              </View>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Swipe Through</Text>
                <Text style={styles.stepDescription}>
                  Review emails with swipe gestures. Done? Swipe away. Need to reply?
                  Mark it for later.
                </Text>
              </View>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>4</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Stay on Top</Text>
                <Text style={styles.stepDescription}>
                  Your TODO list shows emails needing replies. Never miss an
                  important follow-up again.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Privacy Section */}
        <View style={styles.privacySection}>
          <Text style={styles.sectionTitle}>Your Privacy Matters</Text>
          <Text style={styles.privacyText}>
            DoneWith takes your privacy seriously. We never sell your data, never use
            your emails for advertising, and never share your information with third
            parties. Your emails are processed securely and you can revoke access at
            any time.
          </Text>
          <Link href="/privacy" asChild>
            <TouchableOpacity style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Read Privacy Policy</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerLinks}>
            <Link href="/privacy" style={styles.footerLink}>
              <Text style={styles.footerLinkText}>Privacy Policy</Text>
            </Link>
            <Text style={styles.footerDivider}>•</Text>
            <Link href="/terms" style={styles.footerLink}>
              <Text style={styles.footerLinkText}>Terms of Service</Text>
            </Link>
          </View>
          <Text style={styles.copyright}>
            © {new Date().getFullYear()} DoneWith. All rights reserved.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: Platform.OS === "web" ? 20 : 10,
    maxWidth: 1200,
    alignSelf: "center",
    width: "100%",
  },
  logo: {
    fontSize: 24,
    fontWeight: "700",
    color: "#6366F1",
  },
  headerLinks: {
    flexDirection: "row",
    gap: 20,
  },
  headerLink: {
    padding: 8,
  },
  headerLinkText: {
    fontSize: 14,
    color: "#666",
  },
  hero: {
    padding: 40,
    paddingTop: 60,
    paddingBottom: 80,
    alignItems: "center",
    backgroundColor: "#F8F7FF",
  },
  heroTitle: {
    fontSize: Platform.OS === "web" ? 56 : 40,
    fontWeight: "800",
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: Platform.OS === "web" ? 64 : 48,
  },
  heroSubtitle: {
    fontSize: 18,
    color: "#666",
    textAlign: "center",
    maxWidth: 600,
    lineHeight: 28,
    marginBottom: 32,
  },
  ctaButton: {
    backgroundColor: "#6366F1",
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  ctaButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  featuresSection: {
    padding: 40,
    maxWidth: 1200,
    alignSelf: "center",
    width: "100%",
  },
  sectionTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 40,
  },
  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 24,
  },
  featureCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 24,
    width: Platform.OS === "web" ? 340 : "100%",
    maxWidth: 340,
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 14,
    color: "#666",
    lineHeight: 22,
  },
  howItWorksSection: {
    padding: 40,
    backgroundColor: "#F8F7FF",
  },
  stepsList: {
    maxWidth: 600,
    alignSelf: "center",
    width: "100%",
  },
  step: {
    flexDirection: "row",
    marginBottom: 32,
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  stepNumberText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: "#666",
    lineHeight: 22,
  },
  privacySection: {
    padding: 40,
    alignItems: "center",
    maxWidth: 600,
    alignSelf: "center",
  },
  privacyText: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: "#6366F1",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  secondaryButtonText: {
    color: "#6366F1",
    fontSize: 14,
    fontWeight: "600",
  },
  footer: {
    padding: 40,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  footerLinks: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  footerLink: {
    padding: 4,
  },
  footerLinkText: {
    color: "#666",
    fontSize: 14,
  },
  footerDivider: {
    color: "#ccc",
    marginHorizontal: 12,
  },
  copyright: {
    color: "#999",
    fontSize: 13,
  },
});
