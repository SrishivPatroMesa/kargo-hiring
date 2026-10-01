"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconList, IconRubric, IconUpload, KargoMark } from "./Icons";

const LINKS = [
  { href: "/", label: "Shortlist", Icon: IconList },
  { href: "/upload", label: "Upload CVs", Icon: IconUpload },
  { href: "/rubric", label: "Rubric", Icon: IconRubric },
];

export default function Nav() {
  const path = usePathname();
  const login = path === "/login";
  return (
    <header className="top">
      <div className="top-inner">
        <Link href="/" className="brand" aria-label="Kargo hiring home">
          <KargoMark />
          <span className="brand-name">Kargo</span>
          <span className="brand-sub">Hiring</span>
        </Link>
        {!login && (
          <nav aria-label="Main">
            {LINKS.map(({ href, label, Icon }) => (
              <Link key={href} href={href} className={path === href ? "on" : ""} aria-label={label} aria-current={path === href ? "page" : undefined}>
                <Icon size={16} /><span className="nav-label">{label}</span>
              </Link>
            ))}
          </nav>
        )}
        {!login && (
          <div className="who-me">
            <div style={{ textAlign: "right" }}><b>Arjun Mehta</b>Founder</div>
            <div className="me-avatar">AM</div>
          </div>
        )}
      </div>
      <div className="lane" />
    </header>
  );
}
