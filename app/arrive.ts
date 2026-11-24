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
 * globals.css can hold the page itself back on the cream while the model flies in and drops.
 *
 * Then three things keep the flight smooth (each measured on the Study zoom, 2026-11-24):
 *
 * 1. It flies on the compositor. The browser's own flight animates the group's width and height
 *    (the cut-out and the model are different sizes), and those run on the main thread, which the
 *    new page is busy with: hydration ran in long tasks of 70-160 ms (4× CPU), each one freezing the
 *    model mid-air. The two ends are the same picture at two sizes, both placed by a translation, so
 *    a translation plus a uniform scale is the same flight, and transform alone runs off the main
 *    thread. globals.css sets the group's transform-origin to its corner for this.
 * 2. It waits for the page's first frame. The transition's clock started as the page was revealed,
 *    but its first frame took ~200 ms to paint, so the flight's first quarter was never seen and it
 *    appeared to jump. Everything holds at its start until two frames have gone by.
 * 3. The cut-out lets go onto the model's own first frame (the image marked `data-arrives`). On a
 *    cold load that image can still be on its way, and the cut-out faded onto an empty stage, so
 *    the cut-out holds, opaque, until it decodes (1.5 s at most) while the flight goes on.
 */
export function arrive(base: string) {
  const w = window as Window & { __sallyArrival?: Promise<string> };
  w.__sallyArrival = new Promise(function (done) {
    if (!("onpagereveal" in window)) return done("plain");
    addEventListener("pagereveal", function (e) {
      const t = (e as Event & { viewTransition?: ViewTransition | null }).viewTransition;
      if (!t) return done("plain");
      try {
        const nav = (window as { navigation?: { activation?: { from?: { url?: string } } } }).navigation;
        const from = new URL((nav && nav.activation && nav.activation.from && nav.activation.from.url) || document.referrer);
        if (base && from.origin === location.origin && from.pathname !== base && from.pathname.indexOf(base + "/") !== 0 && t.types) t.types.add("from-study");
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
        // 1. the flight, as a transform only
        all = all.map(function (n) {
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
        all.forEach(function (n) { n.pause(); });
        const painted = new Promise(function (go) {
          requestAnimationFrame(function () { requestAnimationFrame(go); });
          setTimeout(go, 600);
        });
        const img = document.querySelector<HTMLImageElement>("img[data-arrives]");
        const pictured = !img || (img.complete && img.naturalWidth)
          ? Promise.resolve()
          : Promise.race([img.decode(), new Promise(function (go) { setTimeout(go, 1500); })]).catch(function () {});
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
