/**
 * In-app logger that captures logs for display in settings.
 * Intercepts console.log/warn/error to capture all app logs.
 */
import { useSyncExternalStore } from "react";

export interface LogEntry {
  timestamp: number;
  level: "log" | "warn" | "error";
  message: string;
}

const MAX_LOGS = 200;
const logs: LogEntry[] = [];
const listeners: Set<() => void> = new Set();

// Snapshot for useSyncExternalStore - returns a stable reference when logs haven't changed
let logsSnapshot: LogEntry[] = [];

function updateSnapshot() {
  logsSnapshot = [...logs];
}

function notifyListeners() {
  updateSnapshot();
  listeners.forEach(listener => listener());
}

// Store original console methods
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

// Filter out sensitive data (JWT tokens)
function shouldFilter(message: string): boolean {
  return /eyJ[A-Za-z0-9_-]+\.eyJ/.test(message);  // JWT pattern
}

// Intercept console methods
let isIntercepted = false;

function interceptConsole() {
  if (isIntercepted) return;
  isIntercepted = true;

  console.log = (...args: any[]) => {
    originalConsole.log(...args);
    const msg = args.map(formatArg).join(" ");
    if (!shouldFilter(msg)) {
      addLog("log", msg, false);
    }
  };

  console.warn = (...args: any[]) => {
    originalConsole.warn(...args);
    const msg = args.map(formatArg).join(" ");
    if (!shouldFilter(msg)) {
      addLog("warn", msg, false);
    }
  };

  console.error = (...args: any[]) => {
    originalConsole.error(...args);
    const msg = args.map(formatArg).join(" ");
    if (!shouldFilter(msg)) {
      addLog("error", msg, false);
    }
  };
}

function formatArg(arg: any): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

// Start intercepting immediately
interceptConsole();

export const appLogger = {
  log: (message: string) => addLog("log", message, true),
  warn: (message: string) => addLog("warn", message, true),
  error: (message: string) => addLog("error", message, true),

  getLogs: () => [...logs],
  clear: () => {
    logs.length = 0;
    notifyListeners();
  },

  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

function addLog(level: LogEntry["level"], message: string, alsoLogToConsole: boolean) {
  const entry: LogEntry = {
    timestamp: Date.now(),
    level,
    message: message.slice(0, 500), // Truncate long messages
  };

  logs.push(entry);

  // Keep only recent logs
  while (logs.length > MAX_LOGS) {
    logs.shift();
  }

  // Log to original console if requested (for appLogger.log calls)
  if (alsoLogToConsole) {
    originalConsole[level](`[App] ${message}`);
  }

  notifyListeners();
}

// Hook for React components - uses useSyncExternalStore to avoid
// "cannot update a component while rendering a different component" errors
function getSnapshot(): LogEntry[] {
  return logsSnapshot;
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function useAppLogs() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
