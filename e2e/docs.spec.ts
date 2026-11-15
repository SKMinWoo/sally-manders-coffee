// The API's reference page against the OpenAPI document it's drawn from, and the API itself as
// the production build serves it.

import { expect, test } from "./fixtures";

type Doc = { paths: Record<string, Record<string, unknown>> };

test("the reference documents every path in the OpenAPI document", async ({ page, request }) => {
  const doc: Doc = await (await request.get("/api/v1/openapi.json")).json();
  await page.goto("/docs");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The figures, open");
  const headings = (await page.getByRole("heading", { level: 2 }).allInnerTexts()).join("\n");
  for (const path of Object.keys(doc.paths)) expect(headings, path).toContain(path);
});

test("every read-only endpoint answers, with the type it says", async ({ request }) => {
  const doc: Doc = await (await request.get("/api/v1/openapi.json")).json();
  const { today } = await (await request.get("/api/v1/health")).json();
  for (const [path, ops] of Object.entries(doc.paths)) {
    if (!("get" in ops)) continue;
    const url = `/api/v1${path.replace(/^\/api\/v1/, "")}`.replace("{date}", today);
    const res = await request.get(url);
    expect(res.status(), url).toBe(200);
    expect(res.headers()["content-type"], url).toMatch(/application\/json|spreadsheetml/);
  }
});

test("a bad request gets a problem, not a stack trace", async ({ request }) => {
  const res = await request.get("/api/v1/days/not-a-date");
  expect(res.status()).toBe(400);
  expect(res.headers()["content-type"]).toContain("application/problem+json");
  const body = await res.json();
  expect(body.title).toBeTruthy();
  expect(JSON.stringify(body)).not.toMatch(/at \w+ \(|node_modules/);
});
