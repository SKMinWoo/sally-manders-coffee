/**
 * The arrival from the Study, run inline as the home page is parsed (page.tsx puts this function's
 * own source in a <script>, so it must stay self-contained: no imports, nothing from outside).
 *
 * The model's roof lifts once the reader is here to see it: arriving by the Study's zoom, only after
 * the Study's cut-out has finished landing on it. Both are announced by `pagereveal`, which fires
 * before React hydrates, and, on a page the Study pre-loaded, only when the reader actually arrives
 * (React has long since mounted by then). So this leaves a promise for Model.tsx: "landed" after a
 * view transition, "plain" otherwise, at once in a browser without `pagereveal`.
 *
 * A transition that came from outside the shop's base path (the Study) is tagged `from-study`, so
 * globals.css can hold the page itself back on the cream while the model flies in and drops. When
 * the Study measured this page first (it loads it in a hidden frame) its zoom ends with the cut-out
 * exactly over the model, raised a little, and it leaves a short-lived `sally-landing` cookie to say
 * so. That arrival is tagged `landing` too: no flight, only the small drop into place.
 *
 * Then three things keep the arrival smooth (each measured on the Study zoom, 2026-11-24):
 *
 * 1. It moves on the compositor. The browser's own flight animates the group's width and height
 *    (the cut-out and the model can be different sizes), and those run on the main thread, which the
 *    new page is busy with: hydration ran in long tasks of 70-160 ms (4× CPU), each one freezing the
 *    model mid-air. The two ends are the same picture at two sizes, both placed by a translation, so
 *    a translation plus a uniform scale is the same move, and transform alone runs off the main
 *    thread. globals.css sets the group's transform-origin to its corner for this.
 * 2. It waits for the page's first frame. The transition's clock started as the page was revealed,
 *    but its first frame took ~200 ms to paint, so the start of the move was never seen and it
 *    appeared to jump. Everything holds at its start until two frames have gone by.
 * 3. The cut-out lets go onto the model's own first frame (the image marked `data-arrives`). On a
 *    cold load that image can still be on its way, and the cut-out faded onto an empty stage, so
 *    the cut-out holds, opaque, until it is in and decoded while the move goes on: 4 s at most (1.5 s
 *    was too short for a cold load on a phone's connection, and the cut-out let go onto an empty stage).
 *
 * 1 and 2 only happen while the animations are still at their start. On a busy phone this callback
 * can run after they have already played for a while, and resetting them then sent the model back
 * to where it began for a frame: a blink. Late, they are left to run as the browser started them.
 */
export function arrive(base: string) {
  const w = window as Window & { __sallyArrival?: Promise<string> };
  w.__sallyArrival = new Promise(function (done) {
    if (!("onpagereveal" in window)) return done("plain");
    addEventListener("pagereveal", function (e) {
      const t = (e as Event & { viewTransition?: ViewTransition | null }).viewTransition;
      const landing = /(?:^|;\s*)sally-landing=1/.test(document.cookie);
      // read once, whichever way the reader came: a later visit must not inherit it
      if (landing) document.cookie = "sally-landing=; path=/; max-age=0";
      if (!t) return done("plain");
      try {
        const nav = (window as { navigation?: { activation?: { from?: { url?: string } } } }).navigation;
        const from = new URL((nav && nav.activation && nav.activation.from && nav.activation.from.url) || document.referrer);
        if (base && from.origin === location.origin && from.pathname !== base && from.pathname.indexOf(base + "/") !== 0 && t.types) {
          t.types.add("from-study");
          if (landing) t.types.add("landing");
        }
      } catch {}
      t.ready.then(function () {
        const root = document.documentElement;
        const GROUP = "::view-transition-group(sally)";
        const OLD = "::view-transition-old(sally)";
        const pseudo = function (n: Animation) {
          const fx = n.effect as KeyframeEffect | null;
          return (fx && fx.pseudoElement) || "";
        };
        let all = root.getAnimations({ subtree: true }).filter(function (n) {
          return pseudo(n).indexOf("::view-transition") === 0;
        });
        // still at the start? (a frame's grace: the clock may have ticked once)
        const early = all.every(function (n) { return !(Number(n.currentTime) > 20); });
        // 1. the move, as a transform only
        if (early) all = all.map(function (n) {
          if (pseudo(n) !== GROUP) return n;
          try {
            const fx = n.effect as KeyframeEffect;
            const k = fx.getKeyframes();
            const a = k[0], z = k[k.length - 1];
            if (!a || !z) return n;
            const ow = parseFloat(String(a.width)), oh = parseFloat(String(a.height));
            const nw = parseFloat(String(z.width)), nh = parseFloat(String(z.height));
            if (!(ow > 0 && oh > 0 && nw > 0 && nh > 0) || !a.transform || !z.transform) return n;
            const timing = fx.getTiming();
            const flight = root.animate(
              [
                { transform: a.transform + " scale(" + ow / nw + "," + oh / nh + ")", easing: a.easing },
                { transform: z.transform },
              ],
              { duration: timing.duration, delay: timing.delay, fill: "both", pseudoElement: GROUP },
            );
            n.cancel();
            return flight;
          } catch {
            return n;
          }
        });
        // 2 and 3: hold it all at its start until the page has painted, and the cut-out until the
        // model's first frame is in as well
        if (early) all.forEach(function (n) { n.pause(); });
        else all.forEach(function (n) { if (pseudo(n) === OLD) n.pause(); });
        const painted = new Promise(function (go) {
          requestAnimationFrame(function () { requestAnimationFrame(go); });
          setTimeout(go, 600);
        });
        // Asked of the page, not of one element: img.decode() alone rejected within ~40 ms on a cold
        // load while hydration settled the image, or the image was not parsed yet, and the cut-out let
        // go onto an empty stage (2026-11-24). So it looks again every 50 ms until the image there now is in.
        const pictured = new Promise<void>(function (go) {
          const cap = setTimeout(go, 4000);
          const fin = function () { clearTimeout(cap); go(); };
          const look = function () {
            const img = document.querySelector<HTMLImageElement>("img[data-arrives]");
            // none yet is not none at all: a streamed page can be revealed before it is parsed
            if (!img && document.readyState !== "loading") return fin();
            if (img && img.complete && img.naturalWidth) return void img.decode().then(fin, fin);
            setTimeout(look, 50);
          };
          look();
        });
        painted.then(function () {
          all.forEach(function (n) {
            if (pseudo(n) === OLD) pictured.then(function () { n.play(); });
            else n.play();
          });
        });
      }, function () {});
      done(t.finished.then(function () { return "landed"; }, function () { return "landed"; }));
    }, { once: true });
  });
}

/** The inline script: the function above, called with the shop's base path. */
export const arriveScript = (base: string) => `(${arrive.toString()})(${JSON.stringify(base)})`;
