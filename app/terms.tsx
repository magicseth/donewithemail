import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";

export default function TermsOfService() {
  const router = useRouter();
  const effectiveDate = "January 22, 2025";

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {Platform.OS !== "web" && (
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.subtitle}>Effective Date: {effectiveDate}</Text>

        <Text style={styles.paragraph}>
          Welcome to DoneWith. By using our service, you agree to these Terms of Service.
          Please read them carefully.
        </Text>

        <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
        <Text style={styles.paragraph}>
          By accessing or using DoneWith ("the Service"), you agree to be bound by these
          Terms of Service and our Privacy Policy. If you do not agree to these terms,
          do not use the Service.
        </Text>

        <Text style={styles.sectionTitle}>2. Description of Service</Text>
        <Text style={styles.paragraph}>
          DoneWith is an AI-powered email management application that helps you:
        </Text>
        <Text style={styles.bulletPoint}>• View and organize your Gmail inbox</Text>
        <Text style={styles.bulletPoint}>• Get AI-generated summaries of emails</Text>
        <Text style={styles.bulletPoint}>• Triage emails with swipe gestures</Text>
        <Text style={styles.bulletPoint}>• Compose and send email replies</Text>
        <Text style={styles.bulletPoint}>• Track emails requiring your response</Text>

        <Text style={styles.sectionTitle}>3. Account Registration</Text>
        <Text style={styles.paragraph}>
          To use DoneWith, you must:
        </Text>
        <Text style={styles.bulletPoint}>• Sign in with a valid Google account</Text>
        <Text style={styles.bulletPoint}>• Grant access to your Gmail account</Text>
        <Text style={styles.bulletPoint}>• Provide accurate account information</Text>
        <Text style={styles.bulletPoint}>• Be at least 13 years of age</Text>
        <Text style={styles.paragraph}>
          You are responsible for maintaining the security of your account and for all
          activities that occur under your account.
        </Text>

        <Text style={styles.sectionTitle}>4. Gmail Access and Permissions</Text>
        <Text style={styles.paragraph}>
          By connecting your Gmail account, you authorize DoneWith to:
        </Text>
        <Text style={styles.bulletPoint}>• Read your emails to display them in the app</Text>
        <Text style={styles.bulletPoint}>• Send emails on your behalf when you use the compose feature</Text>
        <Text style={styles.bulletPoint}>• Modify email labels when you archive or triage emails</Text>
        <Text style={styles.paragraph}>
          You can revoke this access at any time through your Google Account settings at{" "}
          <Text style={styles.link}>https://myaccount.google.com/permissions</Text>
        </Text>

        <Text style={styles.sectionTitle}>5. AI Features</Text>
        <Text style={styles.paragraph}>
          DoneWith uses artificial intelligence to analyze your emails and provide:
        </Text>
        <Text style={styles.bulletPoint}>• Email summaries</Text>
        <Text style={styles.bulletPoint}>• Urgency scoring</Text>
        <Text style={styles.bulletPoint}>• Suggested quick replies</Text>
        <Text style={styles.bulletPoint}>• Calendar event detection</Text>
        <Text style={styles.paragraph}>
          AI-generated content is provided for convenience and may not always be accurate.
          You are responsible for reviewing AI suggestions before taking action.
        </Text>

        <Text style={styles.sectionTitle}>6. User Responsibilities</Text>
        <Text style={styles.paragraph}>
          You agree to:
        </Text>
        <Text style={styles.bulletPoint}>• Use the Service only for lawful purposes</Text>
        <Text style={styles.bulletPoint}>• Not attempt to circumvent security measures</Text>
        <Text style={styles.bulletPoint}>• Not use the Service to send spam or malicious content</Text>
        <Text style={styles.bulletPoint}>• Not interfere with the Service's operation</Text>
        <Text style={styles.bulletPoint}>• Comply with Google's Terms of Service</Text>

        <Text style={styles.sectionTitle}>7. Intellectual Property</Text>
        <Text style={styles.paragraph}>
          DoneWith and its original content, features, and functionality are owned by us
          and are protected by copyright, trademark, and other intellectual property laws.
          Your email content remains your property.
        </Text>

        <Text style={styles.sectionTitle}>8. Disclaimer of Warranties</Text>
        <Text style={styles.paragraph}>
          THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DO NOT
          GUARANTEE THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
          AI-GENERATED CONTENT MAY CONTAIN ERRORS OR INACCURACIES.
        </Text>

        <Text style={styles.sectionTitle}>9. Limitation of Liability</Text>
        <Text style={styles.paragraph}>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY
          INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING
          LOSS OF DATA, BUSINESS INTERRUPTION, OR MISSED COMMUNICATIONS RESULTING FROM
          YOUR USE OF THE SERVICE.
        </Text>

        <Text style={styles.sectionTitle}>10. Email Actions</Text>
        <Text style={styles.paragraph}>
          DoneWith only performs email actions (sending, archiving, labeling) when you
          explicitly trigger them through the app interface. We are not responsible for:
        </Text>
        <Text style={styles.bulletPoint}>• Emails you choose to send through the app</Text>
        <Text style={styles.bulletPoint}>• Emails you archive or delete</Text>
        <Text style={styles.bulletPoint}>• Actions taken based on AI suggestions</Text>

        <Text style={styles.sectionTitle}>11. Service Availability</Text>
        <Text style={styles.paragraph}>
          We strive to maintain Service availability but do not guarantee uninterrupted
          access. The Service may be temporarily unavailable due to maintenance, updates,
          or circumstances beyond our control.
        </Text>

        <Text style={styles.sectionTitle}>12. Termination</Text>
        <Text style={styles.paragraph}>
          You may stop using the Service at any time by:
        </Text>
        <Text style={styles.bulletPoint}>• Deleting your account in Settings</Text>
        <Text style={styles.bulletPoint}>• Revoking Gmail access via Google Account</Text>
        <Text style={styles.paragraph}>
          We may suspend or terminate your access if you violate these Terms or if
          required by law.
        </Text>

        <Text style={styles.sectionTitle}>13. Changes to Terms</Text>
        <Text style={styles.paragraph}>
          We may update these Terms from time to time. We will notify you of significant
          changes. Continued use of the Service after changes constitutes acceptance of
          the new Terms.
        </Text>

        <Text style={styles.sectionTitle}>14. Governing Law</Text>
        <Text style={styles.paragraph}>
          These Terms are governed by the laws of the State of California, United States,
          without regard to conflict of law provisions.
        </Text>

        <Text style={styles.sectionTitle}>15. Contact</Text>
        <Text style={styles.paragraph}>
          For questions about these Terms, contact us at:
        </Text>
        <Text style={styles.bulletPoint}>Email: legal@donewithemail.com</Text>

        <Text style={styles.footer}>
          © {new Date().getFullYear()} DoneWith. All rights reserved.
        </Text>
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
    padding: 24,
    maxWidth: 800,
    alignSelf: "center",
    width: "100%",
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    color: "#6366F1",
    fontSize: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1a1a1a",
    marginTop: 32,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    color: "#444",
    marginBottom: 12,
  },
  bulletPoint: {
    fontSize: 15,
    lineHeight: 24,
    color: "#444",
    marginBottom: 6,
    paddingLeft: 16,
  },
  link: {
    color: "#6366F1",
  },
  footer: {
    fontSize: 13,
    color: "#999",
    marginTop: 48,
    marginBottom: 24,
    textAlign: "center",
  },
});
