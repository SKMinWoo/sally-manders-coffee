import { parts } from "@/server/brief";
import type { Call as CallRow } from "@/server/board";
import s from "./board.module.css";

/** Who wrote the call, in a line, and why the template did when it did. */
export function provenance(c: CallRow): string {
  const who = c.kind === "customer" ? "the regular’s call" : "the manager’s reply";
  if (c.writer !== "template") return `Written by ${c.writer}. It wrote a key wherever a number goes; the database filled each one in, and the guard checked it wrote none of its own.`;
  if (c.guarded) return `The model wrote a draft, and the guard turned it back: ${c.refused}. So ${who} is the plain template, held to the same rule.`;
  if (c.refused) return `The model couldn’t write it (${c.refused}), so ${who} is the plain template, held to the same rule.`;
  return `No model is set up here, so ${who} is the plain template, held to the same rule a model’s draft is.`;
}

/**
 * One line for a morning's pair, when both were written the same way and neither was turned back:
 * said once under both notes, not twice. Null when they differ, and each note says its own.
 */
export function sharedProvenance(a: CallRow | null, b: CallRow | null): string | null {
  if (!a || !b || a.writer !== b.writer || a.refused || b.refused || a.guarded || b.guarded) return null;
  if (a.writer !== "template") return `Both written by ${a.writer}, with a key wherever a number goes. The database filled in each one, and the guard checked the model wrote none of its own.`;
  return "Both written from the shop’s templates, with a key wherever a number goes, and the database filled in each one. A model’s draft is held to the same rule.";
}

/** The body of a call, each figure a link to the API that gave it. */
export function CallBody({ call }: { call: CallRow }) {
  return (
    <p>
      {parts(call.body, call.figures).map((p, i) =>
        typeof p === "string" ? (
          p
        ) : (
          <a key={i} href={p.source} title={p.label} className={s.fig}>
            {p.display}
          </a>
        ),
      )}
    </p>
  );
}

/** A morning's two notes, side by side, and who wrote them: once for both when it's the same. */
export function Calls({ customer, manager, who }: { customer: (CallRow & { speakerName: string }) | null; manager: CallRow | null; who?: string }) {
  const shared = sharedProvenance(customer, manager);
  return (
    <>
      <div className={s.calls}>
        {customer && <Call call={customer} speaker={customer.speakerName} who={who} tone="guest" by={!shared} />}
        {manager && <Call call={manager} speaker="The manager, in reply" tone="manager" by={!shared} />}
      </div>
      {shared && <p className={s.sharedBy}>{shared}</p>}
    </>
  );
}

export function Call({ call, speaker, who, tone, by = true }: { call: CallRow; speaker: string; who?: string; tone: "guest" | "manager"; by?: boolean }) {
  return (
    <figure className={`${s.note} ${tone === "guest" ? s.guest : s.manager}`}>
      <p className={s.noteHead}>
        <span>{speaker}</span>
        {who && <span className={s.noteWho}>{who}</span>}
      </p>
      <blockquote className={s.noteBody}>
        <CallBody call={call} />
      </blockquote>
      {by && <figcaption className={s.noteBy}>{provenance(call)}</figcaption>}
    </figure>
  );
}
