"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import s from "./Header.module.css";

const VIEWS = [
  { href: "/", label: "Storefront", match: (p: string) => p === "/" || p.startsWith("/order") },
  { href: "/behind", label: "Behind the scenes", match: (p: string) => p.startsWith("/behind") },
];

/** Two real routes, so the résumé can link straight to either view. */
export function ViewSwitch() {
  const path = usePathname();
  return (
    <nav className={s.switch} aria-label="View">
      {VIEWS.map((v) => (
        <Link key={v.href} href={v.href} aria-current={v.match(path) ? "page" : undefined}>
          {v.label}
        </Link>
      ))}
    </nav>
  );
}
