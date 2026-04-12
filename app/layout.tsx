import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { MotionProvider } from "@/components/site/motion-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "DirectMS — Wholesale Catalog",
    template: "%s · DirectMS",
  },
  description:
    "Wholesale ordering for disposable pod and vape products. Browse the catalog, pick your flavor, and send your order in minutes.",
  metadataBase: new URL("https://directms.local"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow-md focus:ring-2 focus:ring-ring"
        >
          Skip to main content
        </a>
        <MotionProvider>{children}</MotionProvider>
        <Toaster position="bottom-center" richColors closeButton />
      </body>
    </html>
  );
}
