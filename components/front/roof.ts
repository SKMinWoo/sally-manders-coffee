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
 * TODO(Alex): should this visit see the roof lift off?
 *
 * Lifting it every time is delightful once and tiresome on the fifth visit. Never lifting it wastes
 * the gag. Arriving from the Study is the zoom's punchline, so it probably always lifts.
 * Return true to arrive roofed and lift it; false to arrive already open.
 */
export function shouldLiftRoof({ fromStudy, seenThisSession }: RoofVisit): boolean {
  void fromStudy;
  void seenThisSession;
  return true;
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
