"use client";

import { useState } from "react";
import s from "./export.module.css";

type Said = { tone: "ok" | "same" | "bad"; text: string } | null;

const tagKey = (from: string, to: string) => `sally-export:${from}:${to}`;
const remembered = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const remember = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private window: no memory, every export is fresh */ } };

/**
 * "Export sales": asks the server first (HEAD, with the tag of the last workbook for the same
 * span), so a repeat with nothing new is answered in words and no download starts. Otherwise the
 * browser downloads the workbook itself, straight to disk, so it is never held in this page.
 */
export function ExportSales({ from: defaultFrom, to: today }: { from: string; to: string }) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<Said>(null);

  async function go(e: { preventDefault(): void }) {
    e.preventDefault();
    setBusy(true);
    setSaid(null);
    const url = `/api/v1/exports/sales?${new URLSearchParams({ from, to })}`;
    const key = tagKey(from, to);
    try {
      const last = remembered(key);
      const head = await fetch(url, { method: "HEAD", headers: last ? { "If-None-Match": last } : {} });
      if (head.status === 304) return setSaid({ tone: "same", text: "Nothing changed since your last export of these days." });
      if (!head.ok) {
        // HEAD has no body, so ask again for the problem's wording
        const p = await fetch(url).then((r) => r.json()).catch(() => null);
        return setSaid({ tone: "bad", text: p?.detail ?? p?.title ?? "The export didn't work. Try again in a minute." });
      }
      const tag = head.headers.get("ETag");
      if (tag) remember(key, tag);
      const rows = Number(head.headers.get("X-Export-Rows") ?? 0);
      // a download, not a page: the browser saves the stream to disk and this page stays put
      const a = Object.assign(document.createElement("a"), { href: url, download: "" });
      a.click();
      setSaid({ tone: "ok", text: `Downloading ${rows.toLocaleString("en-US")} order lines.` });
    } catch {
      setSaid({ tone: "bad", text: "Couldn't reach the counter. Check your connection." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={s.export} onSubmit={go} aria-labelledby="export-title">
      <div>
        <h2 id="export-title" className={s.title}>Export sales</h2>
        <p className={s.what}>Every order line between two days, as an Excel workbook, with a Totals sheet to check it against. Up to 92 days.</p>
      </div>
      <label>From <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} required /></label>
      <label>To <input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} required /></label>
      <button type="submit" disabled={busy}>{busy ? "Checking…" : "Export .xlsx"}</button>
      <p className={s.said} data-tone={said?.tone} role="status" aria-live="polite">{said?.text}</p>
    </form>
  );
}
