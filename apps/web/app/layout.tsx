import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BloodNet — Predictive Blood Shortage Network",
  description: "Predictive supply chain and expiry-aware blood transfer network",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-950 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
