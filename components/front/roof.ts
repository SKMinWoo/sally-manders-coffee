// Whether the model arrives with its roof on and lifts it off, or arrives already open. Decided on
// the server from the request (where the visitor came from, and a session cookie), so the first
// paint is already right: a roof that appears and then vanishes on hydration would be worse than
// either. Reduced motion never sees the roof at all; that is the stylesheet's job, not a choice.

export const ROOF_COOKIE = "sally_roof";

export interface RoofVisit {
  /** arrived from the portfolio's Study (the zoom lands here) */
  fromStudy: boolean;
  /** the roof has already lifted once in this browser session */
  seenThisSession: boolean;
}

/**
 * Should this visit see the roof lift off? (decision 0009, proposed)
 *
 * Arriving from the Study always lifts it: that's the zoom's punchline. Otherwise it lifts once a
 * browser session, the first time the shop is opened, and the rest of the visit arrives open, so
 * the fifth trip back from the order page doesn't sit through it again.
 */
export function shouldLiftRoof({ fromStudy, seenThisSession }: RoofVisit): boolean {
  return fromStudy || !seenThisSession;
}

/**
 * Whether the Referer is the Study: the portfolio's own origin, or (when the portfolio's dev server
 * serves the shop under a base path) the same host outside that path.
 */
export function cameFromStudy(referer: string | null, host: string | null, basePath: string, portfolio: string): boolean {
  if (!referer) return false;
  let ref: URL;
  try {
    ref = new URL(referer);
  } catch {
    return false;
  }
  if (ref.origin === portfolio) return true;
  return basePath !== "" && ref.host === host && !ref.pathname.startsWith(basePath);
}
