"use client";

import { useEffect } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { Toaster } from "react-hot-toast";
import { CurrencyProvider } from "@/lib/currency";
import { KEEP_INTENT_KEY, REMEMBER_MAX_AGE } from "@/lib/remember";

function KeepSync() {
  const { status, update } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;
    let intent: string | null = null;
    try {
      intent = sessionStorage.getItem(KEEP_INTENT_KEY);
    } catch {
      return;
    }
    if (intent !== "1" && intent !== "0") return;
    try {
      sessionStorage.removeItem(KEEP_INTENT_KEY);
    } catch {
      /* ignore */
    }

    if (intent === "1") {
      fetch("/api/auth/remember", { method: "POST" })
        .then(() => update({ stayUntil: Date.now() + REMEMBER_MAX_AGE * 1000 }))
        .catch(() => null);
    } else {
      fetch("/api/auth/remember", { method: "DELETE" }).catch(() => null);
    }
  }, [status, update]);

  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <KeepSync />
      <CurrencyProvider>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: "pp-toast",
            duration: 3500,
            success: { iconTheme: { primary: "#0E9F6E", secondary: "#fff" } },
            error: { iconTheme: { primary: "#D64545", secondary: "#fff" } },
          }}
        />
      </CurrencyProvider>
    </SessionProvider>
  );
}