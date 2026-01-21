import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useAction, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

export default function AddImapScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("993");
  const [tls, setTls] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const testConnection = useAction(api.imapAuthActions.testImapConnection);
  const storeCredentials = useMutation(api.imapAuth.storeImapCredentials);

  const handleTest = async () => {
    if (!email || !password || !host || !port) {
      const message = "Please fill in all fields";
      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Missing Information", message);
      }
      return;
    }

    setIsTesting(true);
    try {
      const result = await testConnection({
        email,
        password,
        host,
        port: parseInt(port),
        tls,
      });

      if (result.success) {
        if (Platform.OS === "web") {
          window.alert("Connection successful!");
        } else {
          Alert.alert("Success", "Connection successful!");
        }
      } else {
        if (Platform.OS === "web") {
          window.alert(`Connection failed: ${result.message}`);
        } else {
          Alert.alert("Connection Failed", result.message);
        }
      }
    } catch (error: any) {
      const message = error.message || "Failed to test connection";
      if (Platform.OS === "web") {
        window.alert(`Error: ${message}`);
      } else {
        Alert.alert("Error", message);
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!email || !password || !host || !port) {
      const message = "Please fill in all fields";
      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Missing Information", message);
      }
      return;
    }

    setIsSaving(true);
    try {
      await storeCredentials({
        email,
        password,
        host,
        port: parseInt(port),
        tls,
      });

      if (Platform.OS === "web") {
        window.alert("IMAP account added successfully!");
      } else {
        Alert.alert("Success", "IMAP account added successfully!");
      }
      router.back();
    } catch (error: any) {
      const message = error.message || "Failed to save credentials";
      if (Platform.OS === "web") {
        window.alert(`Error: ${message}`);
      } else {
        Alert.alert("Error", message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const setPreset = (preset: "gmail" | "outlook" | "yahoo") => {
    switch (preset) {
      case "gmail":
        setHost("imap.gmail.com");
        setPort("993");
        setTls(true);
        break;
      case "outlook":
        setHost("outlook.office365.com");
        setPort("993");
        setTls(true);
        break;
      case "yahoo":
        setHost("imap.mail.yahoo.com");
        setPort("993");
        setTls(true);
        break;
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Add IMAP Account</Text>
        <Text style={styles.subtitle}>
          Connect any email account using IMAP
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Setup</Text>
        <View style={styles.presetButtons}>
          <TouchableOpacity
            style={styles.presetButton}
            onPress={() => setPreset("gmail")}
          >
            <Text style={styles.presetButtonText}>Gmail</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.presetButton}
            onPress={() => setPreset("outlook")}
          >
            <Text style={styles.presetButtonText}>Outlook</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.presetButton}
            onPress={() => setPreset("yahoo")}
          >
            <Text style={styles.presetButtonText}>Yahoo</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Details</Text>
        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password / App Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              autoComplete="password"
            />
            <Text style={styles.helpText}>
              For Gmail, use an App Password. Enable 2FA first, then generate
              at: myaccount.google.com/apppasswords
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Server Settings</Text>
        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>IMAP Server</Text>
            <TextInput
              style={styles.input}
              value={host}
              onChangeText={setHost}
              placeholder="imap.example.com"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoComplete="off"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Port</Text>
            <TextInput
              style={styles.input}
              value={port}
              onChangeText={setPort}
              placeholder="993"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Use TLS/SSL</Text>
              <TouchableOpacity
                style={[styles.switch, tls && styles.switchActive]}
                onPress={() => setTls(!tls)}
              >
                <View style={[styles.switchThumb, tls && styles.switchThumbActive]} />
              </TouchableOpacity>
            </View>
            <Text style={styles.helpText}>
              TLS/SSL is recommended for secure connections (port 993)
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.testButton, (isTesting || isSaving) && styles.buttonDisabled]}
          onPress={handleTest}
          disabled={isTesting || isSaving}
        >
          {isTesting ? (
            <ActivityIndicator color="#6366F1" />
          ) : (
            <Text style={styles.testButtonText}>Test Connection</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, (isTesting || isSaving) && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={isTesting || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save & Connect</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    padding: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: "#6366F1",
    fontWeight: "600",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  presetButtons: {
    flexDirection: "row",
    gap: 12,
  },
  presetButton: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  presetButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#111827",
  },
  helpText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 6,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switch: {
    width: 51,
    height: 31,
    borderRadius: 16,
    backgroundColor: "#E5E7EB",
    padding: 2,
  },
  switchActive: {
    backgroundColor: "#6366F1",
  },
  switchThumb: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
  },
  switchThumbActive: {
    transform: [{ translateX: 20 }],
  },
  buttonContainer: {
    padding: 20,
    gap: 12,
  },
  testButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#6366F1",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6366F1",
  },
  saveButton: {
    backgroundColor: "#6366F1",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
