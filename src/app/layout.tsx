import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { GlobalAiAssistant } from "@/components/assistant/GlobalAiAssistant";

export const metadata: Metadata = {
  title: "Synth Nova - AI Clinical Visit Copilot",
  description:
    "Amazon Nova-powered clinical visit copilot for transcript summarization, SOAP note generation, and grounded patient-safe chat.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          {children}
          <GlobalAiAssistant />
        </AuthProvider>
      </body>
    </html>
  );
}
