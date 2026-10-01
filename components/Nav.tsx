"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Shortlist" },
  { href: "/upload", label: "Upload CVs" },
  { href: "/rubric", label: "Rubric" },
];

export default function Nav() {
  const path = usePathname();
  if (path === "/login") return null;
  return (
    <nav>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={path === l.href ? "on" : ""}>{l.label}</Link>
      ))}
    </nav>
  );
}
