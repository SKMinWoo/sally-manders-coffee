import { test } from "node:test";
import assert from "node:assert/strict";
import { csvFields, percentile, readSamples, summarise } from "./load-facts.mjs";

test("a quoted field keeps its commas and doubled quotes", () => {
  assert.deepEqual(csvFields('1,"Not Found, sorry","say ""hi""",true'), ["1", "Not Found, sorry", 'say "hi"', "true"]);
});

test("percentiles by nearest rank: P95 of 1..20 is 19, of 1..100 is 95, and of one sample that sample", () => {
  const upTo = (n) => Array.from({ length: n }, (_, i) => i + 1);
  assert.equal(percentile(upTo(20), 95), 19);
  assert.equal(percentile(upTo(100), 95), 95);
  assert.equal(percentile(upTo(100), 99), 99);
  assert.equal(percentile([7], 95), 7);
  assert.equal(percentile([], 95), 0);
});

const HEAD = "timeStamp,elapsed,label,responseCode,responseMessage,threadName,dataType,success,failureMessage,bytes";
const row = (at, ms, label, ok = true) => `${at},${ms},${label},${ok ? 200 : 500},"OK, fine",Visitors 1-1,text,${ok},,100`;

test("JMeter's results become the figure: per endpoint, slowest first, errors counted, the run timed end to end", () => {
  const csv = [
    HEAD,
    row(1000, 10, "GET /"),
    row(1010, 30, "GET /"),
    row(1020, 200, "GET /office"),
    row(1030, 400, "GET /office", false),
    row(1040, 5, "GET /api/v1/health"),
  ].join("\r\n");
  const f = summarise(readSamples(csv), { users: 2, perMinute: 600, seed: { days: 30, orders: 9000 } });
  assert.equal(f.requests, 5);
  assert.equal(f.errors, 1);
  assert.equal(f.durationMs, 1430 - 1000, "from the first request's start to the last one's end");
  assert.deepEqual(f.endpoints.map((e) => e.name), ["GET /office", "GET /", "GET /api/v1/health"]);
  assert.deepEqual(f.endpoints[0], { name: "GET /office", requests: 2, errors: 1, p50Ms: 200, p95Ms: 400, p99Ms: 400, maxMs: 400 });
  assert.equal(f.p95Ms, 400);
});

test("a results file without the columns it needs is refused, not read as zeros", () => {
  assert.throws(() => readSamples("timeStamp,label\n1,GET /"), /no "elapsed" column/);
  assert.throws(() => summarise([], { users: 1, perMinute: 1, seed: { days: 0, orders: 0 } }), /no requests/);
});
