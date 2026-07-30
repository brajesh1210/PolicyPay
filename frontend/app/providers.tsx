"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";
import { CurrencyProvider } from "@/lib/currency";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
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
