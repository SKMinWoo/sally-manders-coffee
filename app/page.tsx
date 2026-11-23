import Link from "next/link";
import { unstable_cache } from "next/cache";
import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import o from "./order/order.module.css";
import { FIXTURES, type FixtureKey } from "@/components/front/fixtures";
import type { FixtureClaim } from "@/components/front/Model";
import { Room } from "@/components/front/Room";
import { cameFromStudy, ROOF_COOKIE, shouldLiftRoof } from "@/components/front/roof";
import { ExampleCheck } from "@/components/shop/GuestCheck";
import { MenuBoard } from "@/components/shop/MenuBoard";
import { HOUSE_ID, MENU_GROUPS } from "@/server/menu";
import { engineering } from "@/server/office";
import { expectedWait, getMenu, getPulse, listFootfall } from "@/server/orders";
import { now, stoppedAt } from "@/server/platform/clock";
import { shopDb } from "@/server/platform/db/client";
import { FOOTFALL_WINDOW_MS } from "@/server/api/v1";
import { getBehind } from "@/server/reporting";
import { getBoard, inProse, lineOf } from "@/server/board";
import { PORTFOLIO } from "@/lib/site";
import { formatCheckDate, weekdayOf } from "@/lib/time";
import { clock, LEAD_METRICS, METRICS, versus, WEEKDAYS } from "./behind/metrics";
import s from "./page.module.css";
/** Set when the shop is served under a path (the portfolio's dev server proxies it at /shop). */
const BASE = process.env.NEXT_PUBLIC_SHOP_BASE ?? "";

/**
 * Arriving by the Study's zoom, the model's roof should lift only once the Study's cut-out has
 * finished landing on it. The page's view transition is announced by `pagereveal`, which fires
 * before React hydrates, so this runs inline as the page is parsed and leaves a promise for
 * Model.tsx to wait on (none when there's no transition).
 */
const ARRIVE = `addEventListener("pagereveal",function(e){if(e.viewTransition)window.__sallyLanding=e.viewTransition.finished.catch(function(){})},{once:true})`;

// the back office's report, a minute stale at most, so the home page doesn't run its queries per visit
const getEngineering = unstable_cache(async () => engineering(await shopDb(), now()), ["engineering", stoppedAt()], { revalidate: 60 });

export default async function Shop() {
  await connection(); // rendered per request (from one-minute caches), never at build, which has no database
  const at = now();
  const frozen = stoppedAt() !== "";
  const [menu, pulse, report, day, guests, h, jar, work] = await Promise.all([
    getMenu(),
    getPulse(),
    getEngineering(),
    getBehind(),
    listFootfall(await shopDb(), new Date(at.getTime() - FOOTFALL_WINDOW_MS), at),
    headers(),
    cookies(),
    getBoard(),
  ]);
  const line = lineOf(work);

  const lift = shouldLiftRoof({
    fromStudy: cameFromStudy(h.get("referer"), h.get("host"), BASE, PORTFOLIO),
    seenThisSession: jar.has(ROOF_COOKIE),
  });

  // each fixture's back-office card: whether it runs yet, and the figure the plate shows
  const claims: Partial<Record<FixtureKey, FixtureClaim>> = {};
  for (const f of FIXTURES) {
    const c = report.claims.find((x) => x.id === f.claim);
    if (!c) continue;
    const fig = f.figure === undefined ? undefined : c.figures[f.figure];
    claims[f.key] = { status: c.status, exhibit: c.exhibit, figure: fig ? { label: fig.label, display: fig.display } : null, visual: c.visual };
  }

  // act 1: the shop, and the way in
  const shop = (
    <>
      <div>
        <p className={`cond ${s.kicker}`}>Coffee · Kolaches · Tacos · South Austin</p>
        <h1 className={`block shade ${s.headline}`}>
          Sally Mander&rsquo;s <span className="script">a coffee shop that runs on real software</span>
        </h1>
      </div>
      <div className={s.lede}>
        <p>
          A working demo of a South Austin café: you can order from it, and the guests walking in are today&rsquo;s
          orders, each one stored and timed. Scroll for the numbers it keeps, then for how it&rsquo;s run and built.
        </p>
        <p className={s.cta}>
          <Link href="/order" data-order-cta="">Order ahead</Link>
          <a href="#board">See the menu</a>
        </p>
        {line && (
          // a slip off the board, clipped under the buttons: what the manager is working on, in pen
          <div className={s.slip}>
            <p className={s.slipLine}>
              {line.kind === "trying" && <>This week the manager is trying <b>{inProse(line.name)}</b>, <span>day {line.day} of {line.of}</span></>}
              {line.kind === "planned" && <>From {formatCheckDate(line.startsOn)} the manager is trying <b>{inProse(line.name)}</b></>}
              {line.kind === "kept" && <>The newest change kept: <b>{inProse(line.name)}</b>, since {formatCheckDate(line.since)}</>}
            </p>
            <p className={s.slipFoot}>
              {line.kind === "trying" && (
                <span className={s.slipDays} aria-hidden="true">
                  {Array.from({ length: line.of }, (_, i) => (
                    <i key={i} className={i < line.day ? s.slipDone : undefined} />
                  ))}
                </span>
              )}
              <Link href="/board">See the work &rarr;</Link>
            </p>
          </div>
        )}
      </div>
    </>
  );

  // act 2: three of today's figures, each against the same weekday last week at the same hour
  const weekday = WEEKDAYS[weekdayOf(day.date)]!;
  const numbers = (
    <>
      <div>
        <p className={`cond ${s.kicker}`}>Today so far · as of {clock(day.hour, day.minute)}</p>
        <h2 className={`block shade ${s.headline}`}>
          The numbers <span className="script">every order, counted as it lands</span>
        </h2>
      </div>
      <div className={s.lede}>
        <dl className={s.figs}>
          {LEAD_METRICS.map((k) => {
            const m = METRICS[k];
            const v = m.value(day.today);
            return (
              <div key={k}>
                <dt>{m.label}</dt>
                <dd className={s.fig}>{v === null ? "—" : m.format(v)}</dd>
                <dd className={s.vs}>{versus(k, v, m.value(day.lastWeek), weekday)}</dd>
              </div>
            );
          })}
        </dl>
        <p className={`cond ${s.more}`}>
          <Link href="/behind">All the numbers &rarr;</Link>
          <span>the hour by hour, the top sellers, the morning brief and a sales export</span>
        </p>
      </div>
    </>
  );

  return (
    <main>
      {lift && <script dangerouslySetInnerHTML={{ __html: ARRIVE }} />}
      {/* arriving from the Study, the first frame waits until the model's frame is parsed, so the set
          always has somewhere to land (React hoists this into <head>; without `blocking` it's ignored) */}
      {lift && <link rel="expect" href="#sally-model" {...{ blocking: "render" }} />}
      {/* a stopped clock is for tests and screenshots: no guests mid-stride and no roof mid-lift */}
      <Room
        shop={shop}
        numbers={numbers}
        figures={{
          hours: day.hours,
          lastWeekHours: day.lastWeekHours,
          top: day.top.map(({ name, qty }) => ({ name, qty })),
          wait: { p50: day.today.waitP50, p95: day.today.waitP95 },
          lastWeekWait: { p50: day.lastWeek.waitP50, p95: day.lastWeek.waitP95 },
          asOf: day.asOf,
        }}
        lift={lift && !frozen}
        initial={frozen ? [] : guests.map((g) => ({ placedAt: g.placedAt.getTime(), readyAt: g.readyAt.getTime(), items: g.items, source: g.source }))}
        asOf={at.getTime()}
        frozen={frozen}
        base={BASE}
        claims={claims}
        menuCount={menu.length}
        // the order drawer: the board, and (as on the order page) the wait for 0..50 items at this minute's load
        order={{
          menu,
          groups: MENU_GROUPS,
          houseId: HOUSE_ID,
          date: formatCheckDate(pulse.date),
          waits: Array.from({ length: 51 }, (_, n) => (n ? expectedWait(n, pulse.load, pulse.pace) : 0)),
        }}
      />

      <MenuBoard menu={menu} groups={MENU_GROUPS} houseId={HOUSE_ID} />
      <section className={s.checkrow} aria-labelledby="rail-title">
        <div>
          <p className="cond" style={{ color: "var(--teal)" }}>Your order</p>
          <h2 id="rail-title" className={`script ${s.title}`}>On the rail</h2>
          <p className={s.copy}>
            Your check goes up on the rail behind the counter the moment you order, and comes down when your
            drink does. The rail is how the shop keeps time. The Barton Springs salamander lives in the springs
            of one Austin creek and nowhere else.
          </p>
          <p className={`cond ${s.sample}`}>A sample check: the ticket number and the wait are today&rsquo;s</p>
          <Link href="/order" className={o.go} style={{ display: "inline-block", marginTop: 22 }}>Order ahead</Link>
        </div>
        <ExampleCheck menu={menu} pulse={pulse} />
      </section>
    </main>
  );
}
