import Link from "next/link";
import { Sally, SIGN } from "@/components/sally/Sally";
import { SallyIntro } from "@/components/sally/SallyIntro";
import { ViewSwitch } from "./ViewSwitch";
import s from "./Header.module.css";

/** The black header both views share: the lockup, the hours, and the Storefront / Behind the scenes switch. */
export function Header() {
  return (
    <header className={s.header}>
      <Link className={s.lockup} href="/">
        <SallyIntro className={s.mark}>
          <Sally palette={SIGN.dark} title="" />
        </SallyIntro>
        <span className={`script ${s.wordmark}`}>Sally Mander&rsquo;s</span>
      </Link>
      <span className={`cond ${s.hours}`}>Open all hours · South Austin</span>
      <ViewSwitch />
    </header>
  );
}
