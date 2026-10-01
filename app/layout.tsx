import "./globals.css";
import type { Metadata } from "next";
import Nav from "@/components/Nav";

export const metadata: Metadata = { title: "Kargo hiring", description: "Ranked shortlist for PM and SPM roles" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <div className="brand">Kargo <span>hiring</span></div>
          <Nav />
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
