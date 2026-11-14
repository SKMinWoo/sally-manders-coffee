// The shop's menu: one source for the database seed, the storefront and the simulator.
// `w` is how often an item is chosen in each daypart (see `daypartOf`): a latte is a morning
// drink, cold brew an afternoon one, and almost nobody wants a breakfast taco at 3 pm.

export type MenuGroup = "bar" | "brewed" | "not-coffee" | "food";

export interface MenuItem {
  id: string;
  name: string;
  group: MenuGroup;
  priceCents: number;
  note?: string;
  /** weights for [morning, midday, afternoon, late] */
  w: [number, number, number, number];
}

export const MENU: MenuItem[] = [
  { id: "espresso", name: "Espresso", group: "bar", priceCents: 325, w: [6, 4, 5, 6] },
  { id: "cortado", name: "Cortado", group: "bar", priceCents: 425, w: [7, 5, 5, 4] },
  { id: "cappuccino", name: "Cappuccino", group: "bar", priceCents: 475, w: [10, 5, 3, 3] },
  { id: "latte", name: "Latte", group: "bar", priceCents: 525, w: [16, 9, 7, 6] },
  { id: "sixty-eight", name: "Sixty-Eight", group: "bar", priceCents: 625, note: "iced hibiscus espresso, cold as the springs", w: [8, 8, 8, 5] },
  { id: "drip", name: "Drip coffee", group: "brewed", priceCents: 300, w: [14, 5, 3, 8] },
  { id: "cold-brew", name: "Cold brew", group: "brewed", priceCents: 475, w: [5, 10, 11, 4] },
  { id: "matcha", name: "Iced matcha", group: "not-coffee", priceCents: 575, w: [2, 5, 6, 3] },
  { id: "chai", name: "Chai latte", group: "not-coffee", priceCents: 525, w: [3, 4, 5, 6] },
  { id: "kolache", name: "Sausage kolache", group: "food", priceCents: 400, w: [9, 4, 1, 3] },
  { id: "taco", name: "Breakfast taco", group: "food", priceCents: 450, w: [10, 5, 0, 4] },
  { id: "sticky-bun", name: "Pecan sticky bun", group: "food", priceCents: 475, w: [4, 3, 4, 5] },
  { id: "banana-bread", name: "Banana bread", group: "food", priceCents: 375, w: [3, 3, 4, 4] },
];

export const DAYPARTS = ["morning", "midday", "afternoon", "late"] as const;
export type Daypart = (typeof DAYPARTS)[number];

/** morning 6–10, midday 10–14, afternoon 14–18, late 18–6 */
export function daypartOf(hour: number): 0 | 1 | 2 | 3 {
  if (hour >= 6 && hour < 10) return 0;
  if (hour >= 10 && hour < 14) return 1;
  if (hour >= 14 && hour < 18) return 2;
  return 3;
}

export const isCup = (item: MenuItem) => item.group !== "food";

/** The house drink, lettered in script on the board. */
export const HOUSE_ID = "sixty-eight";

/** The board's sections, in the order they are painted. */
export const MENU_GROUPS: { id: MenuGroup; title: string }[] = [
  { id: "bar", title: "Espresso bar" },
  { id: "brewed", title: "Brewed" },
  { id: "not-coffee", title: "Not coffee" },
  { id: "food", title: "From the warmer" },
];
