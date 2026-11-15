"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { shopDb } from "@/server/db/client";
import { placeVisitorOrder } from "@/server/shop/order";
import { clientIp, visitorHashOf } from "@/server/shop/visitor";

export type OrderState = { message: string } | null;

/** "Put it on the rail": the check arrives as JSON in one form field; placeVisitorOrder validates every part of it. */
export async function putOnRail(_prev: OrderState, form: FormData): Promise<OrderState> {
  const json = form.get("lines");
  if (typeof json !== "string" || json.length > 2_000) return { message: "That check couldn't be read." };
  let lines: unknown;
  try {
    lines = JSON.parse(json);
  } catch {
    return { message: "That check couldn't be read." };
  }

  const result = await placeVisitorOrder(await shopDb(), { lines }, { visitorHash: visitorHashOf(clientIp(await headers())) });
  if (!result.ok) return { message: result.message };
  redirect(`/order/${result.publicId}`);
}
