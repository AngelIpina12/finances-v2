import type { Metadata, Viewport } from "next";
import { DM_Sans, Outfit } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/src/components/providers/theme-provider";
import { cn } from "@/lib/utils";
import { Toaster } from "react-hot-toast";
import Script from "next/script";
import { THEME_INITIALIZATION_SCRIPT } from "@/src/shared/constants/theme";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Welcome",
  description: "Welcome to the Finances web app version 2!",
};

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f8fb' },
    { media: '(prefers-color-scheme: dark)', color: '#151c28' },
  ],
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={cn(
        outfit.variable,
        dmSans.variable,
      )}
    >
      <body
        className="flex min-h-full flex-col font-sans antialiased"
      >
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster position="top-right" />
        <Script
          id="theme-initialization"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_INITIALIZATION_SCRIPT }}
        />
      </body>
    </html>
  );
}
