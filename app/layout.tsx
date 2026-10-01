import "./globals.css";
import type { Metadata } from "next";
import Nav from "@/components/Nav";

export const metadata: Metadata = { title: "Kargo Hiring", description: "Ranked shortlist for Kargo's PM and SPM roles" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect x='3' y='18' width='12' height='9' rx='1.5' fill='%23e8702a'/><rect x='17' y='18' width='12' height='9' rx='1.5' fill='%233c8fb5'/><rect x='10' y='7' width='12' height='9' rx='1.5' fill='%230e2140'/></svg>" />
      </head>
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
