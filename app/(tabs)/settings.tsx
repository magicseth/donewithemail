import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../../lib/authContext";
import { isGmailConnected, initiateGmailOAuth, clearGmailToken } from "../../lib/gmailAuth";

export default function SettingsScreen() {
  const { isLoading, isAuthenticated, user, signIn, signOut } = useAuth();
  const [autoProcess, setAutoProcess] = useState(true);
  const [urgencyThreshold, setUrgencyThreshold] = useState(80);
  const [gmailConnected, setGmailConnected] = useState(false);

  // Check Gmail connection status on mount
  useEffect(() => {
    setGmailConnected(isGmailConnected());
  }, []);

  // Connected providers based on actual connection state
  const connectedProviders = gmailConnected
    ? [
        {
          provider: "gmail",
          email: user?.email || "Connected",
          isConnected: true,
        },
      ]
    : [];

  const handleConnectGmail = () => {
    initiateGmailOAuth();
  };

  const handleDisconnect = (provider: string) => {
    Alert.alert(
      "Disconnect Account",
      `Are you sure you want to disconnect your ${provider} account?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: () => {
            if (provider === "gmail") {
              clearGmailToken();
              setGmailConnected(false);
            }
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => {
          signOut();
        },
      },
    ]);
  };

  // Show sign in screen if not authenticated
  if (!isAuthenticated) {
    return (
      <View style={styles.signInContainer}>
        <Text style={styles.signInTitle}>Welcome to TokMail</Text>
        <Text style={styles.signInSubtitle}>
          Sign in to connect your email and start triaging
        </Text>
        <TouchableOpacity
          style={styles.signInButton}
          onPress={signIn}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.signInButtonText}>Sign in with WorkOS</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "?"}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.email || "User"}
              </Text>
              <Text style={styles.profileEmail}>{user?.email || ""}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Connected Accounts Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connected Accounts</Text>
        <View style={styles.card}>
          {connectedProviders.map((provider) => (
            <View key={provider.provider} style={styles.providerRow}>
              <View style={styles.providerIcon}>
                <Text style={styles.providerIconText}>
                  {provider.provider === "gmail" ? "📧" : "📬"}
                </Text>
              </View>
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>
                  {provider.provider.charAt(0).toUpperCase() +
                    provider.provider.slice(1)}
                </Text>
                <Text style={styles.providerEmail}>{provider.email}</Text>
              </View>
              <TouchableOpacity
                style={styles.disconnectButton}
                onPress={() => handleDisconnect(provider.provider)}
              >
                <Text style={styles.disconnectText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity
            style={styles.connectButton}
            onPress={handleConnectGmail}
          >
            <Text style={styles.connectButtonText}>+ Connect Gmail Account</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* AI Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AI Settings</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Auto-process emails</Text>
              <Text style={styles.settingDescription}>
                Automatically summarize and score new emails
              </Text>
            </View>
            <Switch
              value={autoProcess}
              onValueChange={setAutoProcess}
              trackColor={{ true: "#6366F1" }}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Urgency notification threshold</Text>
              <Text style={styles.settingDescription}>
                Get notified for emails with urgency score above {urgencyThreshold}
              </Text>
            </View>
            <Text style={styles.thresholdValue}>{urgencyThreshold}</Text>
          </View>

          <View style={styles.thresholdButtons}>
            {[50, 65, 80, 95].map((value) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.thresholdButton,
                  urgencyThreshold === value && styles.thresholdButtonActive,
                ]}
                onPress={() => setUrgencyThreshold(value)}
              >
                <Text
                  style={[
                    styles.thresholdButtonText,
                    urgencyThreshold === value &&
                      styles.thresholdButtonTextActive,
                  ]}
                >
                  {value}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={styles.aboutValue}>1.0.0</Text>
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Privacy Policy</Text>
            <Text style={styles.aboutArrow}>→</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Terms of Service</Text>
            <Text style={styles.aboutArrow}>→</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sign Out */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
  },
  profileInfo: {
    marginLeft: 16,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  profileEmail: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  providerRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  providerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
  },
  providerIconText: {
    fontSize: 20,
  },
  providerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  providerName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1a1a1a",
  },
  providerEmail: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  disconnectButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  disconnectText: {
    color: "#FF4444",
    fontSize: 14,
  },
  connectButton: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  connectButtonText: {
    color: "#6366F1",
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: "#1a1a1a",
  },
  settingDescription: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#eee",
    marginLeft: 16,
  },
  thresholdValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6366F1",
  },
  thresholdButtons: {
    flexDirection: "row",
    padding: 16,
    paddingTop: 0,
    gap: 8,
  },
  thresholdButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
  },
  thresholdButtonActive: {
    backgroundColor: "#6366F1",
  },
  thresholdButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  thresholdButtonTextActive: {
    color: "#fff",
  },
  aboutRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  aboutLabel: {
    flex: 1,
    fontSize: 16,
    color: "#1a1a1a",
  },
  aboutValue: {
    fontSize: 16,
    color: "#666",
  },
  aboutArrow: {
    fontSize: 16,
    color: "#999",
  },
  signOutButton: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  signOutText: {
    color: "#FF4444",
    fontSize: 16,
    fontWeight: "600",
  },
  bottomPadding: {
    height: 40,
  },
  signInContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    backgroundColor: "#F5F5F5",
  },
  signInTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  signInSubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  signInButton: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
    alignItems: "center",
  },
  signInButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
