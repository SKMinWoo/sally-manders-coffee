"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { shopDb } from "@/server/platform/db/client";
import { placeVisitorOrder } from "@/server/orders";
import { clientIp, visitorHashOf } from "@/server/orders";
import { now } from "@/server/platform/clock";

export type OrderState = { message: string } | null;

/** What the home page's drawer is told about the order it just hung up, so it can draw the guest at once. */
export type HereState =
  | { ok: true; publicId: string; ticket: string; placedAt: number; readyAt: number; items: number }
  | { ok: false; message: string }
  | null;

/** The check arrives as JSON in one form field; placeVisitorOrder validates every part of it. */
async function place(form: FormData) {
  const json = form.get("lines");
  if (typeof json !== "string" || json.length > 2_000) return { ok: false as const, message: "That check couldn't be read." };
  let lines: unknown;
  try {
    lines = JSON.parse(json);
  } catch {
    return { ok: false as const, message: "That check couldn't be read." };
  }
  return placeVisitorOrder(await shopDb(), { lines }, { visitorHash: visitorHashOf(clientIp(await headers())), now: now() });
}

/** "Put it on the rail" on the order page: on to the order's own page. */
export async function putOnRail(_prev: OrderState, form: FormData): Promise<OrderState> {
  const result = await place(form);
  if (!result.ok) return { message: result.message };
  redirect(`/order/${result.publicId}`);
}

/** The same, from the drawer beside the model: the visitor stays, and watches their guest walk in. */
export async function placeHere(_prev: HereState, form: FormData): Promise<HereState> {
  const result = await place(form);
  if (!result.ok) return { ok: false, message: result.message };
  const { publicId, ticket, placedAt, readyAt, items } = result;
  return { ok: true, publicId, ticket, placedAt: +placedAt, readyAt: +readyAt, items };
}
