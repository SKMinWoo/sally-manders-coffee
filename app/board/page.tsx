import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { formatCheckDate, formatWait } from "@/lib/time";
import { getBoard, inProse, TRIAL_DAYS, type Card, type Morning } from "@/server/board";
import { TOPICS } from "@/server/simulator";
import { Calls } from "./Call";
import s from "./board.module.css";

export const metadata: Metadata = { title: "The work" };

const pct = (f: number) => Math.round(f * 100);
const waitWord = (f: number) => (pct(f) === 0 ? "level" : pct(f) < 0 ? `${-pct(f)}% quicker` : `${pct(f)}% slower`);
const takingsWord = (f: number) => (pct(f) === 0 ? "level" : pct(f) > 0 ? `up ${pct(f)}%` : `down ${-pct(f)}%`);

/** The two figures a card leads with: the wait (in the hours it touches) and takings, against the same days without it. */
function Effect({ c }: { c: Card }) {
  if (!c.effect || !c.deltas) return null;
  const w = c.effect.with;
  const wo = c.effect.without;
  const inHours = w.hoursWaitP50 !== null && wo.hoursWaitP50 !== null;
  return (
    <dl className={s.effect}>
      <div>
        <dt>Typical wait{inHours ? ", its hours" : ""}</dt>
        <dd>
          {formatWait(inHours ? wo.hoursWaitP50! : wo.waitP50)} → {formatWait(inHours ? w.hoursWaitP50! : w.waitP50)}
          <span>{waitWord(c.deltas.wait)}</span>
        </dd>
      </div>
      <div>
        <dt>Takings</dt>
        <dd>
          <span>{takingsWord(c.deltas.takings)}</span>
        </dd>
      </div>
      {c.deltas.staffHoursPerDay > 0 && (
        <div>
          <dt>Barista hours</dt>
          <dd>
            <span>{c.deltas.staffHoursPerDay} more a day</span>
          </dd>
        </div>
      )}
    </dl>
  );
}

function CardBody({ c }: { c: Card }) {
  return (
    <>
      <h3 className={s.cardName}>{c.name}</h3>
      <p className={s.cardWhat}>{c.what}</p>
      <p className={s.cardWhy}>
        For <b>{c.answers}</b>; costs {c.cost}.
      </p>
    </>
  );
}

/** The earlier calls shown open on the floor; the rest fold under one line. */
const LOG_SHOWN = 5;

/** A run of holds for the same reason says it once, on its first row (and again after the fold), then just "held". */
const saysWhy = (log: readonly Morning[], i: number) => i === 0 || i === LOG_SHOWN || log[i - 1]!.heldFor !== log[i]!.heldFor || !!log[i - 1]!.chose;

/** An earlier morning: its date, who called about what, and what the manager did, in pen. */
function Earlier({ m, why }: { m: Morning; why: boolean }) {
  return (
    <details>
      <summary>
        <span className={s.since}>{formatCheckDate(m.day)}</span>
        {m.customer && <span>{m.customer.speakerName}, on {TOPICS[m.customer.payload.topic]}</span>}
        {m.manager && <span className={s.decided}>{m.chose ? `chose ${inProse(m.chose)}` : m.heldFor && why ? `held, with ${inProse(m.heldFor)} still on trial` : "held"}</span>}
      </summary>
      <div className={s.logCalls}>
        <Calls customer={m.customer} manager={m.manager} />
      </div>
    </details>
  );
}

export default async function BoardPage() {
  await connection();
  const b = await getBoard();
  const latest = b.latest;

  return (
    <main>
      <div className="wall-band">
        <p className="cond">The work · {formatCheckDate(b.today)} · a simulated shop</p>
      </div>

      <section className={s.pass} aria-labelledby="work-title">
        <div className={s.head}>
          <div>
            <h1 id="work-title" className={`script ${s.title}`}>The work</h1>
            <p className={s.sub}>
              Every morning one of the regulars calls about their visit the day before, and the manager answers and
              decides what to try next. A change runs a week, then it&rsquo;s measured and either kept or taken back.
              The regulars and the manager are written by a model, or a template; every figure is the database&rsquo;s.
            </p>
            {latest?.customer && (
              <p className={s.teaser}>
                <a href="#morning-title">
                  {latest.customer.speakerName} called {latest.day === b.today ? "this morning" : `on ${formatCheckDate(latest.day)}`} about{" "}
                  {TOPICS[latest.customer.payload.topic]}
                  {latest.chose ? `, and the manager chose ${inProse(latest.chose)}` : ""} · read the call ↓
                </a>
              </p>
            )}
          </div>
          <dl className={s.ledger}>
            <div>
              <dt>Changes tried</dt>
              <dd>{b.counts.tried}</dd>
            </div>
            <div>
              <dt>Kept</dt>
              <dd>{b.counts.kept}</dd>
            </div>
            <div>
              <dt>Since</dt>
              <dd>{b.counts.since ? formatCheckDate(b.counts.since) : "—"}</dd>
            </div>
          </dl>
        </div>

        <div className={`steel-rail ${s.rail}`} aria-hidden="true" />
        <ol className={s.columns} aria-label="The board">
          <li className={s.column}>
            <div className={s.check}>
              <h2 className={s.colTitle}>Heard</h2>
              {b.heard.length ? (
                <ul className={s.heard}>
                  {b.heard.map((h) => (
                    <li key={h.topic}>
                      <span className={s.topic}>{h.label}</span>
                      <span className={s.times} aria-hidden="true">
                        {Array.from({ length: h.times }, (_, i) => (
                          <i key={i} />
                        ))}
                      </span>
                      <span className="visually-hidden">, heard {h.times === 1 ? "once" : `${h.times} times`}</span>
                      <span className={s.lastHeard}>
                        {h.latest.speaker}, {formatCheckDate(h.latest.day)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={s.empty}>Nothing heard yet.</p>
              )}
              <p className={s.colFoot}>The last fortnight&rsquo;s calls</p>
            </div>
          </li>

          <li className={s.column}>
            <div className={s.check}>
              <h2 className={s.colTitle}>Planned</h2>
              {b.planned ? (
                <>
                  <p className={s.when}>From {formatCheckDate(b.planned.startsOn)}</p>
                  <CardBody c={b.planned} />
                </>
              ) : b.next ? (
                <>
                  <p className={s.when}>Chosen {formatCheckDate(b.next.on)}</p>
                  <p className={s.empty}>One change at a time: the next is picked the morning this one is measured.</p>
                  {b.next.open.length > 0 && (
                    <>
                      <p className={s.listHead}>Still on the list</p>
                      <ul className={s.open}>
                        {b.next.open.map((o) => (
                          <li key={o.lever}>{o.name}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              ) : (
                <p className={s.empty}>Nothing waiting.</p>
              )}
            </div>
          </li>

          <li className={s.column}>
            <div className={s.check}>
              <h2 className={s.colTitle}>Trying</h2>
              {b.trying ? (
                <>
                  <p className={s.when}>
                    Day {b.trying.day} of {TRIAL_DAYS}
                  </p>
                  <span className={s.days} aria-hidden="true">
                    {Array.from({ length: TRIAL_DAYS }, (_, i) => (
                      <i key={i} className={i < (b.trying!.day ?? 0) ? s.dayDone : undefined} />
                    ))}
                  </span>
                  <CardBody c={b.trying} />
                  {b.trying.effect ? <Effect c={b.trying} /> : <p className={s.empty}>Its first day is today; the figures come tomorrow.</p>}
                </>
              ) : (
                <p className={s.empty}>Nothing on trial right now.</p>
              )}
            </div>
          </li>

          <li className={s.column}>
            {b.measured.length ? (
              // the last two on the rail; the rest are in the shop as it stands, and all of them in the API
              b.measured.slice(0, 2).map((c, i, shown) => (
                <div key={c.id} className={s.check}>
                  {i === 0 && <h2 className={s.colTitle}>Measured</h2>}
                  <p className={`${s.stamp} ${c.verdict === "kept" ? s.kept : s.back}`}>{c.verdict === "kept" ? "Kept" : "Taken back"}</p>
                  <p className={s.when}>
                    {formatCheckDate(c.startsOn)} to {formatCheckDate(c.endsOn)}
                  </p>
                  <CardBody c={c} />
                  <Effect c={c} />
                  {i === shown.length - 1 && b.measured.length > shown.length && (
                    <p className={s.colFoot}>
                      {b.measured.length - shown.length} earlier, in <a href="/api/v1/board">the board&rsquo;s data</a>
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className={s.check}>
                <h2 className={s.colTitle}>Measured</h2>
                <p className={s.empty}>Nothing measured yet; a change runs a week first.</p>
              </div>
            )}
          </li>
        </ol>
      </section>

      <section className={s.floor}>
        <section aria-labelledby="morning-title">
          <h2 id="morning-title" className={s.h2}>{latest ? `${formatCheckDate(latest.day)}, the morning call` : "The morning call"}</h2>
          {latest ? (
            <Calls customer={latest.customer} manager={latest.manager} who={latest.customer ? `a regular: ${latest.customer.speakerWho}` : undefined} />
          ) : (
            <p className={s.source}>The first call is made before dawn tomorrow, Austin time, about the day before.</p>
          )}
        </section>

        <div>
          <h2 className={s.h2}>The shop as it stands</h2>
          {b.standing.length ? (
            <table className={s.standing}>
              <thead>
                <tr>
                  <th scope="col">Since</th>
                  <th scope="col">Change</th>
                  <th scope="col">Typical wait, its week</th>
                  <th scope="col">Takings, its week</th>
                </tr>
              </thead>
              <tbody>
                {b.standing.map((k) => (
                  <tr key={k.lever}>
                    <td className={s.since}>{formatCheckDate(k.since)}</td>
                    <th scope="row">
                      {k.name}
                      <span className={s.why}>
                        chosen {formatCheckDate(k.proposedOn)}, after a regular raised {k.heard}
                      </span>
                    </th>
                    <td data-label="Typical wait">{k.deltas ? waitWord(k.deltas.wait) : "—"}</td>
                    <td data-label="Takings">{k.deltas ? takingsWord(k.deltas.takings) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className={s.source}>No change has been kept yet, so the shop runs as it opened.</p>
          )}
        </div>

        {b.log.length > 0 && (
          <div>
            <h2 className={s.h2}>Earlier calls</h2>
            <div className={s.log}>
              {b.log.slice(0, LOG_SHOWN).map((m, i) => (
                <Earlier key={m.day} m={m} why={saysWhy(b.log, i)} />
              ))}
              {b.log.length > LOG_SHOWN && (
                <details className={s.older}>
                  <summary>{b.log.length - LOG_SHOWN} earlier calls</summary>
                  {b.log.slice(LOG_SHOWN).map((m, i) => (
                    <Earlier key={m.day} m={m} why={saysWhy(b.log, LOG_SHOWN + i)} />
                  ))}
                </details>
              )}
            </div>
          </div>
        )}

        <p className={s.source}>
          Each change is measured against the same week replayed by the simulator without it: the same guests, ordering
          the same things, so the only difference is the change. A real shop can&rsquo;t do that; it would hold a week
          out and live with the noise. The changes come from a fixed list, and the manager can only choose from it. Code,
          not the model, decides whether a choice stands and whether a change is kept. The board is open as data at{" "}
          <a href="/api/v1/board">/api/v1/board</a>, and <Link href="/office">How it&rsquo;s built</Link> shows the code behind it.
        </p>
      </section>
    </main>
  );
}
