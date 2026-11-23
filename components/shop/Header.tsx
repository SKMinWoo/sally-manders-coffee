import Link from "next/link";
import { Sally, SIGN } from "@/components/sally/Sally";
import { SallyIntro } from "@/components/sally/SallyIntro";
import { PORTFOLIO } from "@/lib/site";
import { ViewSwitch } from "./ViewSwitch";
import s from "./Header.module.css";

/**
 * The black header every page shares: a thin line back to the résumé this shop belongs to, then the
 * lockup, the hours, and the shop's three parts.
 */
export function Header() {
  return (
    <header className={s.header}>
      <p className={`cond ${s.back}`}>
        <a href={PORTFOLIO}>
          <span aria-hidden="true">← </span>Back to the résumé
        </a>
        <span className={s.backNote}>Sally Mander&rsquo;s is a working demo, built to show how its developer works</span>
      </p>
      <div className={s.bar}>
        <Link className={s.lockup} href="/">
          <SallyIntro className={s.mark}>
            <Sally palette={SIGN.dark} title="" />
          </SallyIntro>
          <span className={`script ${s.wordmark}`}>Sally Mander&rsquo;s</span>
        </Link>
        <span className={`cond ${s.hours}`}>Open all hours · South Austin</span>
        <ViewSwitch />
      </div>
    </header>
  );
}
