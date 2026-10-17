import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Guardian",
  description: "Voice-first grocery and pharmacy for elderly parents, approved by family.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
