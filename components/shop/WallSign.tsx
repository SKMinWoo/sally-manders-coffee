import Image from "next/image";
import Link from "next/link";
import cup from "@/public/cup.png";
import s from "./WallSign.module.css";

/** The hand-painted sign on the turquoise wall out front, with the to-go cup on its mustard disc. */
export function WallSign() {
  return (
    <div className={s.wall}>
      <div className={s.sign}>
        <p className={`cond ${s.est}`}>Coffee · Est. this morning · Austin, Texas</p>
        <h1 className={`script shade ${s.name}`}>Sally Mander&rsquo;s</h1>
        <p className={`block ${s.ribbon}`}>Coffee · Kolaches · Tacos</p>
        <p className={s.line}>Spring-fed since this morning.</p>
        <div className={s.cta}>
          <Link href="/order">Order ahead</Link>
          <a href="#board">See the board</a>
        </div>
      </div>
      <div className={s.cupside}>
        <span className={s.disc} />
        <svg className={s.arc} viewBox="0 0 200 200" aria-hidden="true">
          <defs>
            <path id="cup-arc" d="M30 100a70 70 0 0 1 140 0" />
          </defs>
          <text className={s.arcText} fontSize="15" letterSpacing="4" fill="currentColor">
            <textPath href="#cup-arc" startOffset="50%" textAnchor="middle">HOT · ICED · TO GO</textPath>
          </text>
        </svg>
        <Image src={cup} alt="A turquoise to-go cup printed with Sally in her mug" sizes="(max-width: 860px) 200px, 22vw" priority />
      </div>
    </div>
  );
}
