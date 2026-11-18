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
import { getMenu, getPulse, listFootfall } from "@/server/orders";
import { now, stoppedAt } from "@/server/platform/clock";
import { shopDb } from "@/server/platform/db/client";
import { FOOTFALL_WINDOW_MS } from "@/server/api/v1";
import s from "./page.module.css";

/** The résumé site, whose Study zooms into this page. */
const PORTFOLIO = "https://alex-minwoo-kim.vercel.app";
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

export default async function Storefront() {
  await connection(); // rendered per request (from one-minute caches), never at build, which has no database
  const at = now();
  const frozen = stoppedAt() !== "";
  const [menu, pulse, report, guests, h, jar] = await Promise.all([
    getMenu(),
    getPulse(),
    getEngineering(),
    listFootfall(await shopDb(), new Date(at.getTime() - FOOTFALL_WINDOW_MS), at),
    headers(),
    cookies(),
  ]);

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
    claims[f.key] = { status: c.status, exhibit: c.exhibit, figure: fig ? { label: fig.label, display: fig.display } : null };
  }

  const intro = (
    <header className={s.intro}>
      <div>
        <p className={`cond ${s.kicker}`}>Coffee · Kolaches · Tacos · South Austin</p>
        <h1 className={`block shade ${s.headline}`}>
          See how it&rsquo;s built <span className="script">lift the roof off Sally Mander&rsquo;s</span>
        </h1>
      </div>
      <div className={s.lede}>
        <p>
          Every fixture in this shop is a working part of the software behind it: the door is the API, the pantry is
          the database, the van ships each release. The guests walking in are today&rsquo;s orders, as the simulator
          wrote them.
        </p>
        <p className={s.cta}>
          <Link href="/order">Order ahead</Link>
          <a href="#board">See the board</a>
        </p>
      </div>
    </header>
  );

  return (
    <main>
      {lift && <script dangerouslySetInnerHTML={{ __html: ARRIVE }} />}
      {/* arriving from the Study, the first frame waits until the model's frame is parsed, so the set
          always has somewhere to land (React hoists this into <head>; without `blocking` it's ignored) */}
      {lift && <link rel="expect" href="#sally-model" {...{ blocking: "render" }} />}
      {/* a stopped clock is for tests and screenshots: no guests mid-stride and no roof mid-lift */}
      <Room
        intro={intro}
        lift={lift && !frozen}
        initial={frozen ? [] : guests.map((g) => ({ placedAt: g.placedAt.getTime(), readyAt: g.readyAt.getTime(), items: g.items, source: g.source }))}
        asOf={at.getTime()}
        frozen={frozen}
        base={BASE}
        claims={claims}
        menuCount={menu.length}
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
