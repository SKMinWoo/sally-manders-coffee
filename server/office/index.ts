// The back office: the eleven résumé claims, the figures CI measures for them, and the endpoint
// CI reports to. Depends on orders and reporting for the figures the shop counts live.

export { codeUrl, SITE, type Role } from "./claims";
export { engineering, type ClaimReport, type Figure } from "./engineering";
export { ingestCi, MAX_BODY_BYTES } from "./ingest";
export { FACTORS, type Factor } from "./twelve-factor";
