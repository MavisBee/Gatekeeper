import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Gatekeeper",
  description: "Secure and state-of-the-art entry door to your applications.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-50 font-sans">
        {children}
      </body>
    </html>
  );
}
