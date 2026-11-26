import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/shop/Header";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sally Mander's · South Austin", template: "%s · Sally Mander's" },
  description: "A simulated coffee shop in South Austin that never closes, built to show how its developer works.",
};

/**
 * Leaving for a page that doesn't take part in view transitions (the résumé site, say) aborts the
 * one this page started, and the browser reports its rejected promises as uncaught errors. The
 * abort is expected; this marks them handled.
 */
const LEAVING = `addEventListener("pageswap",function(e){var t=e.viewTransition;if(t){var n=function(){};t.ready.catch(n);t.finished.catch(n);t.updateCallbackDone.catch(n)}})`;

/**
 * Arriving from the Study (or moving between pages), the browser decides at the new page's first
 * frame whether to carry the view transition over. The opt-in is inline, so it's there at that
 * frame however the stylesheets arrive (in dev they can land a beat late, and the transition was
 * then skipped). The morph's own timing is in globals.css.
 */
const OPT_IN = "@view-transition{navigation:auto}";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: OPT_IN }} />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: LEAVING }} />
        <Header />
        {children}
        <p className="sim-note">
          Sally Mander&rsquo;s is a simulated coffee shop, built to show how its developer works. The orders,
          the takings and the waits come from a simulator; nothing here is for sale. The figures are open:{" "}
          <Link href="/docs">read the API</Link>, follow <Link href="/board">the work</Link> the manager is doing
          to improve it, or see <Link href="/office">the résumé, running</Link>, where each
          line of the developer&rsquo;s résumé sits beside the version of it running here.
        </p>
      </body>
    </html>
  );
}
