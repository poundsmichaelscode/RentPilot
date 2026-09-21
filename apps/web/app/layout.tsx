import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000",
  ),
  title: "RentPilot — Rent, managed with confidence",
  description: "A shared rent management workspace for landlords, tenants and property teams.",
  openGraph: { title: "RentPilot", description: "Rent, managed with confidence.", images: ["/og.png"] },
  twitter: { card: "summary_large_image", title: "RentPilot", description: "Rent, managed with confidence.", images: ["/og.png"] },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
