"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import s from "./Header.module.css";

/**
 * The site in four parts, proof first: the résumé, running (each claim beside its working twin), then
 * the shop that is its demo, the figures it keeps and the work going on to improve it. `short` is what fits beside the lockup on a phone; the full
 * label stays for screen readers.
 */
const PARTS = [
  { href: "/office", label: "Résumé, running", short: "Résumé", match: (p: string) => p.startsWith("/office") || p.startsWith("/docs") },
  { href: "/", label: "The shop", short: "Shop", match: (p: string) => p === "/" || p.startsWith("/order") },
  { href: "/behind", label: "The numbers", short: "Numbers", match: (p: string) => p.startsWith("/behind") },
  { href: "/board", label: "The work", short: "Work", match: (p: string) => p.startsWith("/board") },
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
