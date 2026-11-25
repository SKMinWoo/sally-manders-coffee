// The back office: the eleven résumé claims, the figures CI measures for them, and the endpoint
// CI reports to. Depends on orders, reporting and the brief for the figures the shop counts live.

export { codeUrl, SITE, type Role } from "./claims";
export { engineering, type Chart, type ClaimReport, type Figure, type Trend, type Visual } from "./engineering";
export { ingestCi, MAX_BODY_BYTES } from "./ingest";
export { FACTORS, type Factor } from "./twelve-factor";
