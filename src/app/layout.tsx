import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description = "Build a wearable cardboard Ship mascot, sized to you. Cut files included. Fan-made.";

export const metadata: Metadata = {
  metadataBase: new URL("https://ship-mascot.vercel.app"),
  title: "Ship mascot · cardboard costume",
  description,
  openGraph: { title: "Ship mascot · cardboard costume", description, url: "/", siteName: "Ship mascot" },
  twitter: { card: "summary_large_image", title: "Ship mascot · cardboard costume", description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
