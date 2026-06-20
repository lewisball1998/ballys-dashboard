import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bally's Dashboard",
  description: "A homelab infrastructure command centre.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
