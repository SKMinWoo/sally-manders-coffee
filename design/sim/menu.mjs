// The shop's menu: one source for the storefront, the simulator and, later, the database seed.
// `w` is how often an item is picked in each daypart: [morning 6–10, midday 10–14, afternoon 14–18].
// `house` is the signature drink; each brand direction gives it its own name.

export const MENU = [
  { id: "espresso", name: "Espresso", group: "bar", price: 3.25, w: [6, 4, 5] },
  { id: "cortado", name: "Cortado", group: "bar", price: 4.25, w: [7, 5, 5] },
  { id: "cappuccino", name: "Cappuccino", group: "bar", price: 4.75, w: [10, 5, 3] },
  { id: "latte", name: "Latte", group: "bar", price: 5.25, w: [16, 9, 7] },
  { id: "house", name: "House signature", group: "bar", price: 6.25, w: [8, 8, 8] },
  { id: "drip", name: "Drip coffee", group: "brewed", price: 3.0, w: [14, 5, 3] },
  { id: "cold-brew", name: "Cold brew", group: "brewed", price: 4.75, w: [5, 10, 11] },
  { id: "matcha", name: "Iced matcha", group: "not-coffee", price: 5.75, w: [2, 5, 6] },
  { id: "chai", name: "Chai latte", group: "not-coffee", price: 5.25, w: [3, 4, 5] },
  { id: "kolache", name: "Sausage kolache", group: "food", price: 4.0, w: [9, 4, 1] },
  { id: "taco", name: "Breakfast taco", group: "food", price: 4.5, w: [10, 5, 0] },
  { id: "sticky-bun", name: "Pecan sticky bun", group: "food", price: 4.75, w: [4, 3, 4] },
  { id: "banana-bread", name: "Banana bread", group: "food", price: 3.75, w: [3, 3, 4] },
];

export const OPEN = 6; // first hour served
export const CLOSE = 18; // doors shut
