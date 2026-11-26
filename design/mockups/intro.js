// Sally's entrance in the header mark: she slithers up out of her mug, settles, then winks.
// Plain Web Animations on the groups names.js labels (s-in, s-tail, s-body, s-gills, s-arm, s-eye,
// s-lid), so there is no library and nothing to download. Hovering the logo afterwards replays the wink.
(() => {
  const lockup = document.querySelector(".lockup");
  const svg = lockup?.querySelector("[data-mascot] svg");
  const part = (name) => svg?.querySelector(`.s-${name}`);
  const [inside, tail, body, gills, arm, eye, lid] = ["in", "tail", "body", "gills", "arm", "eye", "lid"].map(part);
  if (!lid) return; // not the full mark, so nothing to animate

  // The mockup plays her entrance on every load. The app plays it once a visit (decision 0009).
  function shouldPlayIntro() {
    return !matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // the rim: whatever of her is below this line is inside the mug, so rising out of it is a reveal
  const clip = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
  clip.id = "s-rim";
  clip.innerHTML = '<rect x="0" y="0" width="400" height="113"/>';
  svg.prepend(clip);
  inside.setAttribute("clip-path", "url(#s-rim)");

  // pivots, as a share of each part's own box: the tail and body swing from where they leave the mug,
  // the gills from where they meet her head, the arm from her shoulder, the eye from its centre
  const pivot = (el, at) => Object.assign(el.style, { transformBox: "fill-box", transformOrigin: at });
  pivot(tail, "50% 100%");
  pivot(body, "18% 95%");
  pivot(gills, "100% 70%");
  pivot(arm, "0% 0%");
  pivot(eye, "50% 50%");
  svg.style.transformOrigin = "50% 100%";

  const settle = "cubic-bezier(.3, .7, .4, 1)";

  function wink(at = 0) {
    const shut = { duration: 560, delay: at, easing: "ease-in-out" };
    eye.animate([{ transform: "none" }, { transform: "scaleY(.08)", offset: 0.16 }, { transform: "scaleY(.08)", offset: 0.76 }, { transform: "none" }], shut);
    lid.animate([{ opacity: 0 }, { opacity: 1, offset: 0.16 }, { opacity: 1, offset: 0.76 }, { opacity: 0 }], shut);
    // a small, cheeky tip of the head while the eye is shut
    body.animate([{ transform: "none" }, { transform: "rotate(-4deg)", offset: 0.24 }, { transform: "rotate(-4deg)", offset: 0.7 }, { transform: "none" }], { duration: 640, delay: at - 30, easing: settle });
  }

  function enter() {
    const go = (el, frames, o) => el.animate(frames, { fill: "both", easing: settle, ...o });
    // the tail tip comes first, swishing as it rises
    go(tail, [
      { transform: "translateY(48px) rotate(-18deg)" },
      { transform: "translateY(10px) rotate(14deg)", offset: 0.45 },
      { transform: "translateY(-2px) rotate(-7deg)", offset: 0.75 },
      { transform: "none" },
    ], { duration: 720, delay: 100 });
    // then her body slithers up: side to side as she rises, a little past the rim, and back
    go(body, [
      { transform: "translateY(58px) rotate(12deg)" },
      { transform: "translateY(18px) rotate(-8deg)", offset: 0.3 },
      { transform: "translateY(-5px) rotate(6deg)", offset: 0.58 },
      { transform: "translateY(1px) rotate(-2.5deg)", offset: 0.8 },
      { transform: "none" },
    ], { duration: 980, delay: 280 });
    // the mug gives a little as she pushes up off its floor
    svg.animate([{ transform: "none" }, { transform: "scale(1.035, .955)" }, { transform: "none" }], { duration: 300, delay: 640, easing: "ease-out" });
    // her arm flops over the rim once she is up
    go(arm, [
      { opacity: 0, transform: "rotate(-75deg) scale(.55)" },
      { opacity: 1, transform: "rotate(12deg) scale(1.05)", offset: 0.6 },
      { opacity: 1, transform: "rotate(-3deg)", offset: 0.82 },
      { opacity: 1, transform: "none" },
    ], { duration: 460, delay: 1000 });
    // the gills arrive a beat behind her head and flutter as she stops
    go(gills, [
      { transform: "rotate(10deg)" },
      { transform: "rotate(-14deg)", offset: 0.35 },
      { transform: "rotate(7deg)", offset: 0.65 },
      { transform: "none" },
    ], { duration: 700, delay: 980, easing: "ease-out" });
    wink(1720);
  }

  // a visitor who lingers on the logo gets the wink again, at most once a second and a half,
  // and not while the entrance is still playing
  let last = -Infinity;
  if (shouldPlayIntro()) { enter(); last = performance.now() + 1500; }

  lockup.addEventListener("pointerenter", () => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || performance.now() - last < 1500) return;
    last = performance.now();
    wink(0);
  });
})();
