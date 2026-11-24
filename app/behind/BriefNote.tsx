import Link from "next/link";
import { formatCheckDate } from "@/lib/time";
import { parts, type Brief } from "@/server/brief";
import s from "./page.module.css";

/** Who wrote the note, in a line, and why the template did when it did. */
function provenance(b: Brief): string {
  if (b.writer !== "template")
    return `Written by ${b.writer} from yesterday’s figures. It wrote a key wherever a number goes; the database filled each one in, and the guard checked it wrote none of its own.`;
  if (b.guarded) return `The model wrote a draft, and the guard turned it back: ${b.refused}. So this is the plain template, which keeps the same rule.`;
  if (b.refused) return `The model couldn’t write it (${b.refused}), so this is the plain template, which keeps the same rule.`;
  return "No model is set up here, so this is the plain template, held to the same rule a model’s draft is.";
}

/** Yesterday's note from the manager, each figure a link to the API that gave it. */
export function BriefNote({ brief }: { brief: Brief | null }) {
  return (
    <section id="brief" className={s.brief} aria-labelledby="brief-title">
      <h2 id="brief-title" className={s.h2}>Yesterday, from the manager</h2>
      {brief ? (
        <figure className={s.note}>
          <p className={s.noteDate}>{formatCheckDate(brief.day)}</p>
          <blockquote className={s.noteBody}>
            <p>
              {parts(brief.body, brief.figures).map((p, i) =>
                typeof p === "string" ? (
                  p
                ) : (
                  <a key={i} href={p.source} title={p.label} className={s.fig}>
                    {p.display}
                  </a>
                ),
              )}
            </p>
          </blockquote>
          <figcaption className={s.noteBy}>
            {provenance(brief)} What the manager is changing about the shop, and why, is on <Link href="/board">the work</Link>.
          </figcaption>
        </figure>
      ) : (
        <p className={s.source}>The first note is written the morning after the shop’s first full day.</p>
      )}
    </section>
  );
}
