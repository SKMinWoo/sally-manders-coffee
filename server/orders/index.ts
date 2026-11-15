// Orders: a visitor's order, from the menu to the rail and the wait it quotes, and every read of
// the orders table, through placedBy() so nothing shows before it happens. Depends on the menu,
// and on the simulator for how busy the bar is.

export { placeVisitorOrder } from "./place";
export { findOrder, placedBy } from "./repository";
export { getMenu, getPulse, type Pulse } from "./storefront";
export { clientIp, visitorHashOf } from "./visitor";
export { expectedWait } from "./wait";
