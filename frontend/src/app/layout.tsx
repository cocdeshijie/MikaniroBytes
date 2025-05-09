import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

import { JotaiProvider } from "@/providers/jotai-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { ScrollProvider } from "@/providers/scroll-provider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ToastProvider } from "@/providers/toast-provider";

/* ------------------------------------------------------------------ */
/*                            LOCAL FONTS                             */
/* ------------------------------------------------------------------ */
const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Mikaniro🍊Bytes",
  description: "Upload and share anything!",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ToastProvider>
          <JotaiProvider>
            <ThemeProvider>
              <ScrollProvider>
                <Header />
                {children}
                <Footer />
              </ScrollProvider>
            </ThemeProvider>
          </JotaiProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
