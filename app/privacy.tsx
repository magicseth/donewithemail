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

export default function PrivacyPolicy() {
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

        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.subtitle}>Effective Date: {effectiveDate}</Text>

        <Text style={styles.paragraph}>
          DoneWith ("we," "our," or "us") is an AI-powered email management application.
          This Privacy Policy explains how we collect, use, and protect your information
          when you use our service.
        </Text>

        <Text style={styles.sectionTitle}>1. Information We Collect</Text>

        <Text style={styles.subSectionTitle}>1.1 Account Information</Text>
        <Text style={styles.paragraph}>
          When you sign up, we collect your email address and basic profile information
          (name, profile picture) from your Google account to create and manage your account.
        </Text>

        <Text style={styles.subSectionTitle}>1.2 Gmail Data</Text>
        <Text style={styles.paragraph}>
          With your explicit authorization, we access your Gmail account to provide our
          email management features. We collect and process:
        </Text>
        <Text style={styles.bulletPoint}>• Email metadata (sender, recipient, subject, date)</Text>
        <Text style={styles.bulletPoint}>• Email content (body text) for AI summarization</Text>
        <Text style={styles.bulletPoint}>• Email labels and read/unread status</Text>
        <Text style={styles.bulletPoint}>• Contact information from your emails</Text>

        <Text style={styles.subSectionTitle}>1.3 How We Use Gmail Data</Text>
        <Text style={styles.paragraph}>
          Your Gmail data is used exclusively to provide DoneWith's core features:
        </Text>
        <Text style={styles.bulletPoint}>• Displaying your emails in the DoneWith interface</Text>
        <Text style={styles.bulletPoint}>• Generating AI-powered email summaries and urgency scores</Text>
        <Text style={styles.bulletPoint}>• Suggesting quick reply options</Text>
        <Text style={styles.bulletPoint}>• Sending emails on your behalf when you compose or reply</Text>
        <Text style={styles.bulletPoint}>• Archiving and labeling emails based on your actions</Text>
        <Text style={styles.bulletPoint}>• Detecting calendar events mentioned in emails</Text>

        <Text style={styles.sectionTitle}>2. Google API Scopes</Text>
        <Text style={styles.paragraph}>
          We request the following Google permissions:
        </Text>
        <Text style={styles.subSectionTitle}>Account & Profile</Text>
        <Text style={styles.bulletPoint}>
          • <Text style={styles.bold}>userinfo.email</Text> - To identify your account
        </Text>
        <Text style={styles.bulletPoint}>
          • <Text style={styles.bold}>userinfo.profile</Text> - To display your name and profile picture
        </Text>
        <Text style={styles.subSectionTitle}>Gmail Access</Text>
        <Text style={styles.bulletPoint}>
          • <Text style={styles.bold}>gmail.readonly</Text> - To read and display your emails
        </Text>
        <Text style={styles.bulletPoint}>
          • <Text style={styles.bold}>gmail.send</Text> - To send emails when you compose or reply
        </Text>
        <Text style={styles.bulletPoint}>
          • <Text style={styles.bold}>gmail.modify</Text> - To archive emails and update labels when you triage
        </Text>
        <Text style={styles.subSectionTitle}>Calendar Access</Text>
        <Text style={styles.bulletPoint}>
          • <Text style={styles.bold}>calendar</Text> - To access your Google Calendar
        </Text>
        <Text style={styles.bulletPoint}>
          • <Text style={styles.bold}>calendar.events</Text> - To create calendar events from emails
        </Text>
        <Text style={styles.subSectionTitle}>Contacts Access</Text>
        <Text style={styles.bulletPoint}>
          • <Text style={styles.bold}>contacts.readonly</Text> - To autocomplete email addresses when composing
        </Text>

        <Text style={styles.sectionTitle}>3. Data Storage and Security</Text>

        <Text style={styles.subSectionTitle}>3.1 Where Data is Stored</Text>
        <Text style={styles.paragraph}>
          Your data is stored securely on Convex, our serverless database provider.
          Email content and sensitive information is encrypted at rest.
        </Text>

        <Text style={styles.subSectionTitle}>3.2 Data Retention</Text>
        <Text style={styles.paragraph}>
          We retain your email data while your account is active. Email summaries and
          metadata are kept to provide the service. You can delete your account at any
          time, which will remove all your data from our systems.
        </Text>

        <Text style={styles.subSectionTitle}>3.3 Security Measures</Text>
        <Text style={styles.paragraph}>
          We implement industry-standard security measures including:
        </Text>
        <Text style={styles.bulletPoint}>• Encryption in transit (HTTPS/TLS)</Text>
        <Text style={styles.bulletPoint}>• Encryption at rest for sensitive data</Text>
        <Text style={styles.bulletPoint}>• OAuth 2.0 for secure Gmail authentication</Text>
        <Text style={styles.bulletPoint}>• No storage of Gmail passwords</Text>

        <Text style={styles.sectionTitle}>4. Third-Party Services</Text>
        <Text style={styles.paragraph}>
          We use the following third-party services to provide our features:
        </Text>
        <Text style={styles.bulletPoint}>
          • <Text style={styles.bold}>Google Gmail API</Text> - Email access and management
        </Text>
        <Text style={styles.bulletPoint}>
          • <Text style={styles.bold}>Anthropic Claude AI</Text> - Email summarization and analysis
        </Text>
        <Text style={styles.bulletPoint}>
          • <Text style={styles.bold}>Convex</Text> - Database and backend services
        </Text>
        <Text style={styles.bulletPoint}>
          • <Text style={styles.bold}>WorkOS</Text> - Authentication services
        </Text>

        <Text style={styles.sectionTitle}>5. What We Do NOT Do</Text>
        <Text style={styles.paragraph}>
          We are committed to protecting your privacy:
        </Text>
        <Text style={styles.bulletPoint}>• We do NOT sell your data to third parties</Text>
        <Text style={styles.bulletPoint}>• We do NOT use your email content for advertising</Text>
        <Text style={styles.bulletPoint}>• We do NOT share your emails with other users</Text>
        <Text style={styles.bulletPoint}>• We do NOT train AI models on your personal email content</Text>
        <Text style={styles.bulletPoint}>• We do NOT send emails without your explicit action</Text>

        <Text style={styles.sectionTitle}>6. Your Rights</Text>
        <Text style={styles.paragraph}>
          You have the right to:
        </Text>
        <Text style={styles.bulletPoint}>• Access the data we hold about you</Text>
        <Text style={styles.bulletPoint}>• Request deletion of your data</Text>
        <Text style={styles.bulletPoint}>• Revoke Gmail access at any time via Google Account settings</Text>
        <Text style={styles.bulletPoint}>• Export your data</Text>
        <Text style={styles.bulletPoint}>• Opt out of AI summarization features</Text>

        <Text style={styles.sectionTitle}>7. Data Deletion</Text>
        <Text style={styles.paragraph}>
          To delete your data:
        </Text>
        <Text style={styles.bulletPoint}>1. Go to Settings in the DoneWith app</Text>
        <Text style={styles.bulletPoint}>2. Select "Delete Account"</Text>
        <Text style={styles.bulletPoint}>3. Confirm deletion</Text>
        <Text style={styles.paragraph}>
          You can also revoke our access to your Gmail at any time by visiting{" "}
          <Text style={styles.link}>https://myaccount.google.com/permissions</Text>
        </Text>

        <Text style={styles.sectionTitle}>8. Children's Privacy</Text>
        <Text style={styles.paragraph}>
          DoneWith is not intended for users under 13 years of age. We do not knowingly
          collect information from children under 13.
        </Text>

        <Text style={styles.sectionTitle}>9. Changes to This Policy</Text>
        <Text style={styles.paragraph}>
          We may update this Privacy Policy from time to time. We will notify you of
          significant changes through the app or via email.
        </Text>

        <Text style={styles.sectionTitle}>10. Contact Us</Text>
        <Text style={styles.paragraph}>
          If you have questions about this Privacy Policy or your data, contact us at:
        </Text>
        <Text style={styles.bulletPoint}>Email: privacy@donewithemail.com</Text>

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
  subSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginTop: 16,
    marginBottom: 8,
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
  bold: {
    fontWeight: "600",
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
