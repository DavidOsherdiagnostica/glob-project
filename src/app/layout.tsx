import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ORBITAL-WATCH | Satellite Tracker",
  description: "Real-time 3D satellite tracking dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-black">{children}</body>
    </html>
  );
}
