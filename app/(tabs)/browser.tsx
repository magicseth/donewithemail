import React, { useState, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import Markdown from "react-native-markdown-display";
import { VoiceRecordButton } from "../../components/VoiceRecordButton";
import { useAuth } from "../../lib/authContext";

interface BrowserAction {
  action: "navigate" | "click" | "fill" | "scroll";
  url?: string;
  target?: string;
  selector?: string;
  value?: string;
  field?: string;
  direction?: "up" | "down" | "top" | "bottom";
  amount?: string;
  reason?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  browserActions?: BrowserAction[];
}

// JavaScript to inject into WebView for content extraction
const CONTENT_EXTRACTION_SCRIPT = `
(function() {
  // Get visible text content
  function getVisibleText(element) {
    if (!element) return '';
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return '';

    let text = '';
    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent + ' ';
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tagName = child.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'iframe'].includes(tagName)) continue;
        text += getVisibleText(child);
        if (['p', 'div', 'br', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
          text += '\\n';
        }
      }
    }
    return text;
  }

  const content = getVisibleText(document.body);
  const title = document.title;
  const url = window.location.href;

  // Clean up the content
  const cleanContent = content
    .replace(/\\s+/g, ' ')
    .replace(/\\n\\s*\\n/g, '\\n')
    .trim()
    .substring(0, 15000); // Limit content length

  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'pageContent',
    content: cleanContent,
    title: title,
    url: url
  }));
})();
`;

// JavaScript to click an element
const createClickScript = (target: string, selector?: string) => `
(function() {
  let element = null;

  // Try selector first if provided
  if ('${selector || ""}') {
    element = document.querySelector('${selector}');
  }

  // If no selector or not found, search by text content
  if (!element) {
    const targetText = '${target}'.toLowerCase();

    // Search buttons
    const buttons = document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]');
    for (const btn of buttons) {
      if (btn.textContent.toLowerCase().includes(targetText) ||
          btn.value?.toLowerCase().includes(targetText) ||
          btn.getAttribute('aria-label')?.toLowerCase().includes(targetText)) {
        element = btn;
        break;
      }
    }

    // Search links if no button found
    if (!element) {
      const links = document.querySelectorAll('a');
      for (const link of links) {
        if (link.textContent.toLowerCase().includes(targetText) ||
            link.getAttribute('aria-label')?.toLowerCase().includes(targetText)) {
          element = link;
          break;
        }
      }
    }

    // Search any clickable element
    if (!element) {
      const clickables = document.querySelectorAll('[onclick], [role="link"], [role="button"]');
      for (const el of clickables) {
        if (el.textContent.toLowerCase().includes(targetText)) {
          element = el;
          break;
        }
      }
    }
  }

  if (element) {
    element.click();
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'actionResult',
      action: 'click',
      success: true,
      message: 'Clicked element'
    }));
  } else {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'actionResult',
      action: 'click',
      success: false,
      message: 'Could not find element to click: ${target}'
    }));
  }
})();
`;

// JavaScript to fill a form field
const createFillScript = (field: string, value: string, selector?: string) => `
(function() {
  let element = null;

  // Try selector first if provided
  if ('${selector || ""}') {
    element = document.querySelector('${selector}');
  }

  // If no selector or not found, search by common patterns
  if (!element) {
    const fieldName = '${field}'.toLowerCase();
    const inputs = document.querySelectorAll('input, textarea');

    for (const input of inputs) {
      const name = (input.name || '').toLowerCase();
      const placeholder = (input.placeholder || '').toLowerCase();
      const label = input.getAttribute('aria-label')?.toLowerCase() || '';
      const type = (input.type || '').toLowerCase();

      if (name.includes(fieldName) ||
          placeholder.includes(fieldName) ||
          label.includes(fieldName) ||
          (fieldName.includes('search') && type === 'search') ||
          (fieldName.includes('email') && type === 'email') ||
          (fieldName.includes('password') && type === 'password')) {
        element = input;
        break;
      }
    }

    // Try finding by associated label
    if (!element) {
      const labels = document.querySelectorAll('label');
      for (const lbl of labels) {
        if (lbl.textContent.toLowerCase().includes(fieldName)) {
          const forId = lbl.getAttribute('for');
          if (forId) {
            element = document.getElementById(forId);
            break;
          }
        }
      }
    }
  }

  if (element) {
    element.value = '${value.replace(/'/g, "\\'")}';
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'actionResult',
      action: 'fill',
      success: true,
      message: 'Filled field with value'
    }));
  } else {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'actionResult',
      action: 'fill',
      success: false,
      message: 'Could not find field: ${field}'
    }));
  }
})();
`;

// JavaScript to scroll the page
const createScrollScript = (direction: string, amount?: string) => `
(function() {
  const scrollAmount = window.innerHeight * 0.8;

  switch('${direction}') {
    case 'up':
      window.scrollBy(0, -scrollAmount);
      break;
    case 'down':
      window.scrollBy(0, scrollAmount);
      break;
    case 'top':
      window.scrollTo(0, 0);
      break;
    case 'bottom':
      window.scrollTo(0, document.body.scrollHeight);
      break;
  }

  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'actionResult',
    action: 'scroll',
    success: true,
    message: 'Scrolled ${direction}'
  }));
})();
`;

export default function BrowserScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [urlInput, setUrlInput] = useState("https://www.google.com");
  const [currentUrl, setCurrentUrl] = useState("https://www.google.com");
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [pageContent, setPageContent] = useState<string>("");
  const [pageTitle, setPageTitle] = useState<string>("");
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [streamingTranscript, setStreamingTranscript] = useState("");

  const webViewRef = useRef<WebView>(null);
  const flatListRef = useRef<FlatList>(null);
  const { user } = useAuth();

  const startBrowserChat = useAction(api.browserAgent.startBrowserChat);
  const continueBrowserChat = useAction(api.browserAgent.continueBrowserChat);

  // Handle messages from WebView
  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === "pageContent") {
        setPageContent(data.content);
        setPageTitle(data.title);
        setCurrentUrl(data.url);
        setUrlInput(data.url);
      } else if (data.type === "actionResult") {
        console.log(`[Browser] Action result:`, data);
        if (!data.success) {
          Alert.alert("Action Failed", data.message);
        }
      }
    } catch (e) {
      console.error("[Browser] Failed to parse WebView message:", e);
    }
  }, []);

  // Extract page content when page loads
  const handleLoadEnd = useCallback(() => {
    setIsPageLoading(false);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(CONTENT_EXTRACTION_SCRIPT);
    }
  }, []);

  // Navigate to URL
  const handleNavigate = useCallback((url: string) => {
    let finalUrl = url.trim();

    // Add https:// if no protocol
    if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
      if (finalUrl.includes(".") && !finalUrl.includes(" ")) {
        finalUrl = `https://${finalUrl}`;
      } else {
        // Treat as search query
        finalUrl = `https://www.google.com/search?q=${encodeURIComponent(finalUrl)}`;
      }
    }

    setCurrentUrl(finalUrl);
    setUrlInput(finalUrl);
  }, []);

  // Execute browser actions from AI
  const executeBrowserAction = useCallback(
    (action: BrowserAction) => {
      if (!webViewRef.current) return;

      switch (action.action) {
        case "navigate":
          if (action.url) {
            handleNavigate(action.url);
          }
          break;
        case "click":
          if (action.target) {
            webViewRef.current.injectJavaScript(createClickScript(action.target, action.selector));
          }
          break;
        case "fill":
          if (action.field && action.value) {
            webViewRef.current.injectJavaScript(createFillScript(action.field, action.value, action.selector));
          }
          break;
        case "scroll":
          if (action.direction) {
            webViewRef.current.injectJavaScript(createScrollScript(action.direction, action.amount));
          }
          break;
      }
    },
    [handleNavigate]
  );

  // Send message to AI
  const handleSend = useCallback(async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmedInput,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      let response: string;
      let browserActions: BrowserAction[] | undefined;

      if (threadId) {
        const result = await continueBrowserChat({
          threadId,
          message: trimmedInput,
          pageContent: pageContent || undefined,
          pageUrl: currentUrl || undefined,
          pageTitle: pageTitle || undefined,
        });
        response = result.response;
        browserActions = result.browserActions;
      } else {
        const result = await startBrowserChat({
          message: trimmedInput,
          pageContent: pageContent || undefined,
          pageUrl: currentUrl || undefined,
          pageTitle: pageTitle || undefined,
        });
        setThreadId(result.threadId);
        response = result.response;
        browserActions = result.browserActions;
      }

      // Add assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
        browserActions,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Execute browser actions
      if (browserActions && browserActions.length > 0) {
        for (const action of browserActions) {
          executeBrowserAction(action);
        }
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [
    input,
    isLoading,
    threadId,
    pageContent,
    currentUrl,
    pageTitle,
    startBrowserChat,
    continueBrowserChat,
    executeBrowserAction,
  ]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setThreadId(null);
  }, []);

  const handleVoiceTranscript = useCallback((transcript: string) => {
    setInput(transcript);
    setIsRecordingVoice(false);
    setStreamingTranscript("");
  }, []);

  const handleStreamingTranscript = useCallback((transcript: string) => {
    setStreamingTranscript(transcript);
  }, []);

  const handleVoiceError = useCallback((error: string) => {
    Alert.alert("Voice Recording Error", error);
    setIsRecordingVoice(false);
  }, []);

  // Markdown styles
  const markdownStyles = useMemo(
    () => ({
      body: {
        color: "#1a1a1a",
        fontSize: 14,
        lineHeight: 20,
      },
      strong: {
        fontWeight: "800" as const,
      },
      link: {
        color: "#6366F1",
        textDecorationLine: "underline" as const,
      },
    }),
    []
  );

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      const isUser = item.role === "user";
      return (
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          {isUser ? (
            <Text style={[styles.messageText, styles.userMessageText]}>{item.content}</Text>
          ) : (
            <Markdown style={markdownStyles}>{item.content}</Markdown>
          )}
          {/* Show browser actions if any */}
          {!isUser && item.browserActions && item.browserActions.length > 0 && (
            <View style={styles.actionsContainer}>
              {item.browserActions.map((action, idx) => (
                <View key={idx} style={styles.actionBadge}>
                  <Text style={styles.actionBadgeText}>
                    {action.action === "navigate" && `Navigate to ${action.url?.substring(0, 30)}...`}
                    {action.action === "click" && `Click: ${action.target}`}
                    {action.action === "fill" && `Fill: ${action.field}`}
                    {action.action === "scroll" && `Scroll ${action.direction}`}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      );
    },
    [markdownStyles]
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      {/* URL Bar */}
      <View style={styles.urlBar}>
        <TouchableOpacity style={styles.refreshButton} onPress={() => webViewRef.current?.reload()}>
          <Text style={styles.refreshButtonText}>↻</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.urlInput}
          value={urlInput}
          onChangeText={setUrlInput}
          onSubmitEditing={() => handleNavigate(urlInput)}
          placeholder="Enter URL or search..."
          placeholderTextColor="#999"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <TouchableOpacity style={styles.goButton} onPress={() => handleNavigate(urlInput)}>
          <Text style={styles.goButtonText}>Go</Text>
        </TouchableOpacity>
      </View>

      {/* WebView */}
      <View style={[styles.webViewContainer, isChatExpanded && styles.webViewContainerCollapsed]}>
        {isPageLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#6366F1" />
          </View>
        )}
        <WebView
          ref={webViewRef}
          source={{ uri: currentUrl }}
          style={styles.webView}
          onLoadStart={() => setIsPageLoading(true)}
          onLoadEnd={handleLoadEnd}
          onMessage={handleWebViewMessage}
          onNavigationStateChange={(navState) => {
            setCurrentUrl(navState.url);
            setUrlInput(navState.url);
          }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
        />
      </View>

      {/* Chat Toggle Button */}
      <TouchableOpacity style={styles.chatToggle} onPress={() => setIsChatExpanded(!isChatExpanded)}>
        <Text style={styles.chatToggleText}>{isChatExpanded ? "▼ Hide AI Chat" : "▲ Ask AI about this page"}</Text>
      </TouchableOpacity>

      {/* Chat Panel */}
      {isChatExpanded && (
        <View style={styles.chatPanel}>
          {/* Messages */}
          {messages.length > 0 ? (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesContent}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />
          ) : (
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatTitle}>AI Browser Assistant</Text>
              <Text style={styles.emptyChatSubtitle}>
                Ask me anything about this page, or tell me to navigate, click, or fill forms.
              </Text>
              <View style={styles.examplesContainer}>
                <TouchableOpacity style={styles.exampleButton} onPress={() => setInput("What is this page about?")}>
                  <Text style={styles.exampleText}>What is this page about?</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.exampleButton} onPress={() => setInput("Find prices on this page")}>
                  <Text style={styles.exampleText}>Find prices on this page</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.exampleButton} onPress={() => setInput("Search Google for React docs")}>
                  <Text style={styles.exampleText}>Search for React docs</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* New Chat button */}
          {messages.length > 0 && (
            <TouchableOpacity style={styles.newChatButton} onPress={handleNewChat}>
              <Text style={styles.newChatText}>New Chat</Text>
            </TouchableOpacity>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#6366F1" />
              <Text style={styles.loadingText}>Thinking...</Text>
            </View>
          )}

          {/* Voice transcript */}
          {isRecordingVoice && streamingTranscript && (
            <View style={styles.transcriptContainer}>
              <Text style={styles.transcriptLabel}>Listening...</Text>
              <Text style={styles.transcriptText}>{streamingTranscript}</Text>
            </View>
          )}

          {/* Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask about this page or give commands..."
              placeholderTextColor="#999"
              multiline
              maxLength={500}
              editable={!isLoading && !isRecordingVoice}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />
            <VoiceRecordButton
              onTranscript={handleVoiceTranscript}
              onStreamingTranscript={handleStreamingTranscript}
              onError={handleVoiceError}
              onRecordingStart={() => setIsRecordingVoice(true)}
              onRecordingEnd={() => setIsRecordingVoice(false)}
              disabled={isLoading}
              size="medium"
              style={styles.voiceButton}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!input.trim() || isLoading || isRecordingVoice) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!input.trim() || isLoading || isRecordingVoice}
            >
              <Text
                style={[
                  styles.sendButtonText,
                  (!input.trim() || isLoading || isRecordingVoice) && styles.sendButtonTextDisabled,
                ]}
              >
                Send
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  urlBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#f8f9fa",
    gap: 8,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  refreshButtonText: {
    fontSize: 18,
    color: "#666",
  },
  urlInput: {
    flex: 1,
    height: 36,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    fontSize: 14,
  },
  goButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#6366F1",
    borderRadius: 18,
  },
  goButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  webViewContainer: {
    flex: 1,
  },
  webViewContainerCollapsed: {
    flex: 0.4,
  },
  webView: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  chatToggle: {
    backgroundColor: "#6366F1",
    paddingVertical: 10,
    alignItems: "center",
  },
  chatToggleText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  chatPanel: {
    flex: 0.6,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  emptyChat: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyChatTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  emptyChatSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
  },
  examplesContainer: {
    width: "100%",
    maxWidth: 300,
  },
  exampleButton: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 14,
    color: "#374151",
    textAlign: "center",
  },
  messagesContent: {
    padding: 12,
    paddingBottom: 8,
  },
  messageBubble: {
    maxWidth: "85%",
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  userBubble: {
    backgroundColor: "#6366F1",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: "#F3F4F6",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#1a1a1a",
  },
  userMessageText: {
    color: "#fff",
  },
  actionsContainer: {
    marginTop: 8,
    gap: 4,
  },
  actionBadge: {
    backgroundColor: "#E0E7FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  actionBadgeText: {
    fontSize: 11,
    color: "#4338CA",
    fontWeight: "500",
  },
  newChatButton: {
    position: "absolute",
    top: 8,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  newChatText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6366F1",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: "#666",
  },
  transcriptContainer: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 10,
    marginHorizontal: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "#DC2626",
  },
  transcriptLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#DC2626",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  transcriptText: {
    fontSize: 14,
    color: "#1a1a1a",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "#fff",
    gap: 8,
  },
  voiceButton: {
    alignSelf: "flex-end",
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#1a1a1a",
    maxHeight: 80,
    padding: 10,
    backgroundColor: "#F8F9FA",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  sendButton: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#E0E0E0",
  },
  sendButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  sendButtonTextDisabled: {
    color: "#999",
  },
});
