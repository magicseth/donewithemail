import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import {
  DemoContact,
  DemoEmail,
  DemoSummary,
  generateDemoContacts,
  generateDemoEmails,
  generateDemoSummaries,
} from "./demoMode";

interface DemoModeContextType {
  isDemoMode: boolean;
  demoEmails: DemoEmail[];
  demoContacts: DemoContact[];
  demoSummaries: DemoSummary[];
  enterDemoMode: () => void;
  exitDemoMode: () => void;
  triageEmail: (emailId: string, action: "done" | "reply_needed" | "delegated") => void;
}

const DemoModeContext = createContext<DemoModeContextType | null>(null);

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoContacts] = useState<DemoContact[]>(() => generateDemoContacts());
  const [demoEmails, setDemoEmails] = useState<DemoEmail[]>([]);
  const [demoSummaries, setDemoSummaries] = useState<DemoSummary[]>([]);

  const enterDemoMode = useCallback(() => {
    console.log("[DemoMode] Entering demo mode");
    const contacts = generateDemoContacts();
    const emails = generateDemoEmails(contacts);
    const summaries = generateDemoSummaries(emails);

    setDemoEmails(emails);
    setDemoSummaries(summaries);
    setIsDemoMode(true);
  }, []);

  const exitDemoMode = useCallback(() => {
    console.log("[DemoMode] Exiting demo mode");
    setIsDemoMode(false);
    setDemoEmails([]);
    setDemoSummaries([]);
  }, []);

  const triageEmail = useCallback((emailId: string, action: "done" | "reply_needed" | "delegated") => {
    console.log("[DemoMode] Triaging email:", emailId, action);
    setDemoEmails((prevEmails) =>
      prevEmails.map((email) =>
        email._id === emailId
          ? {
              ...email,
              isTriaged: true,
              triageAction: action,
              triagedAt: Date.now(),
            }
          : email
      )
    );
  }, []);

  return (
    <DemoModeContext.Provider
      value={{
        isDemoMode,
        demoEmails,
        demoContacts,
        demoSummaries,
        enterDemoMode,
        exitDemoMode,
        triageEmail,
      }}
    >
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  const context = useContext(DemoModeContext);
  if (!context) {
    throw new Error("useDemoMode must be used within DemoModeProvider");
  }
  return context;
}
