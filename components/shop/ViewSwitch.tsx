"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import s from "./Header.module.css";

// `short` is what fits beside the lockup on a phone; the full label stays for screen readers
const VIEWS = [
  { href: "/", label: "Storefront", short: "Shop", match: (p: string) => p === "/" || p.startsWith("/order") },
  { href: "/behind", label: "Behind the scenes", short: "Behind", match: (p: string) => p.startsWith("/behind") },
];

/** Two real routes, so the résumé can link straight to either view. */
export function ViewSwitch() {
  const path = usePathname();
  return (
    <nav className={s.switch} aria-label="View">
      {VIEWS.map((v) => (
        <Link key={v.href} href={v.href} aria-current={v.match(path) ? "page" : undefined}>
          <span className={s.long}>{v.label}</span>
          <span className={s.short} aria-hidden="true">{v.short}</span>
          <span className={`visually-hidden ${s.shortLabel}`}>{v.label}</span>
        </Link>
      ))}
    </nav>
  );
}
