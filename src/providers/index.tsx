"use client";

import { QueryProvider } from "./query-provider";
import { AuthProvider } from "./auth-provider";
import { ThemeProvider } from "./theme-provider";
import { MobileProvider } from "./mobile-provider";
import { NotifyProvider } from "./notify-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <QueryProvider>
        <ThemeProvider>
          <MobileProvider>
            <NotifyProvider>{children}</NotifyProvider>
          </MobileProvider>
        </ThemeProvider>
      </QueryProvider>
    </AuthProvider>
  );
}