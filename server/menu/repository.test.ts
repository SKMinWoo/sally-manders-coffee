import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Db } from "@/server/platform/db/client";
import { testDb } from "@/server/platform/db/test-db";
import { listMenu, syncMenu } from "./repository";

let db: Db, close: () => Promise<void>;
before(async () => {
  ({ db, close } = await testDb());
  await syncMenu(db);
});
after(() => close());

test("the menu is seeded in board order", async () => {
  const menu = await listMenu(db);
  assert.equal(menu[0]!.id, "espresso");
  assert.equal(menu.find((m) => m.id === "sixty-eight")!.priceCents, 625);
});
