"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import s from "./Header.module.css";

/**
 * The shop in four parts, in the order a visitor should meet them: the shop itself, the figures it
 * keeps, the work going on to improve it, and how it's built. `short` is what fits beside the lockup on a phone; the full
 * label stays for screen readers.
 */
const PARTS = [
  { href: "/", label: "The shop", short: "Shop", match: (p: string) => p === "/" || p.startsWith("/order") },
  { href: "/behind", label: "The numbers", short: "Numbers", match: (p: string) => p.startsWith("/behind") },
  { href: "/board", label: "The work", short: "Work", match: (p: string) => p.startsWith("/board") },
  { href: "/office", label: "How it’s built", short: "Built", match: (p: string) => p.startsWith("/office") || p.startsWith("/docs") },
];

/** Real routes, so the résumé can link straight to any part. */
export function ViewSwitch() {
  const path = usePathname();
  return (
    <nav className={s.switch} aria-label="Sections">
      {PARTS.map((v) => (
        <Link key={v.href} href={v.href} aria-current={v.match(path) ? "page" : undefined}>
          <span className={s.long}>{v.label}</span>
          <span className={s.short} aria-hidden="true">{v.short}</span>
          <span className={`visually-hidden ${s.shortLabel}`}>{v.label}</span>
        </Link>
      ))}
    </nav>
  );
}
