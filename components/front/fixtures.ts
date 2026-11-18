// What each fixture on the cutaway stands for, in pin order. One list for the tags, the plates and
// the card, so they all say the same thing. `claim` is the back-office card it links to (an id in
// server/office/claims.ts) and `figure` which of that card's figures the plate shows.

export type FixtureKey =
  | "door" | "boards" | "till" | "scanner" | "rail" | "machine" | "desk" | "cabinet" | "certificate" | "clock" | "van" | "pantry" | "dining";

export interface Fixture {
  key: FixtureKey;
  title: string;
  /** what it is in the system, in a few words */
  tech: string;
  blurb: string;
  claim: string;
  /** index into the claim's figures; omitted when the plate shows something of its own */
  figure?: number;
  links?: { label: string; href: string }[];
}

export const FIXTURES: readonly Fixture[] = [
  {
    key: "door", title: "The front door", tech: "the API · /api/v1", claim: "full-stack", figure: 1,
    blurb: "Every guest comes in through here, and so does any partner: the shop orders through the same versioned API it documents as OpenAPI.",
    links: [{ label: "Read the API", href: "/docs" }],
  },
  {
    key: "boards", title: "The menu boards", tech: "GET /api/v1/menu", claim: "full-stack",
    blurb: "Painted from the menu table and cached, so a rush costs the pantry one read every few minutes.",
    links: [{ label: "See the board", href: "#board" }],
  },
  {
    key: "till", title: "The till", tech: "takes the order", claim: "full-stack", figure: 0,
    blurb: "Checks each order and clips a ticket to the rail. Every guest walking in is an order the simulator wrote for today, and each one waits exactly as long as it says.",
    links: [{ label: "Order ahead", href: "/order" }],
  },
  {
    key: "scanner", title: "The scanner", tech: "barcode checks", claim: "barcode", figure: 0,
    blurb: "Every ticket carries a Code 128 barcode. The browser tests read each one back off a screenshot, and refuse the damaged ones.",
  },
  {
    key: "rail", title: "The ticket rail", tech: "the order queue", claim: "full-stack",
    blurb: "A ticket goes up when an order is placed and comes down when it's ready. The wait it quotes rises with the hour's load.",
  },
  {
    key: "machine", title: "The machine", tech: "the app", claim: "re-architecture", figure: 0,
    blurb: "Makes every drink: one Next.js app built as domain modules, each with one way in, and a lint rule that stops them reaching into each other.",
  },
  {
    key: "desk", title: "The brief", tech: "agent + figures guard", claim: "ai-adoption", figure: 1,
    blurb: "Each morning an agent writes the manager's brief. A guard checks that every number in it came from the pantry, and turns back any draft that wrote its own.",
  },
  {
    key: "cabinet", title: "The ledgers", tech: "Excel export", claim: "excel-export", figure: 0,
    blurb: "Any span of days, streamed into a workbook a manager would actually open, and refused if a single check doesn't add up.",
  },
  {
    key: "certificate", title: "The certificate", tech: "CI gates", claim: "quality-gates", figure: 0,
    blurb: "No release without it: unit and browser tests, screenshot baselines and the security scans.",
  },
  {
    key: "clock", title: "The clock", tech: "uptime probe", claim: "zero-downtime", figure: 0,
    blurb: "A probe that checks the shop on a schedule and records every answer.",
  },
  {
    key: "van", title: "The van", tech: "deploys", claim: "aks", figure: 0,
    blurb: "Ships each release: a deploy job, and a Helm chart that Argo CD syncs to a cluster.",
  },
  {
    key: "pantry", title: "The pantry", tech: "Postgres on Neon", claim: "full-stack", figure: 0,
    blurb: "A shelf for each kind of record, kept current by Drizzle migrations. The simulator stocks the day ahead, and every read takes only what has already happened.",
  },
  {
    key: "dining", title: "The dining room", tech: "the load test", claim: "performance", figure: 0,
    blurb: "Each seat stands for a database connection. Under a CI load test, the seats ran out before anything else did.",
    links: [{ label: "What the test found", href: "#plate-3" }],
  },
];

/** The three tags out front; behind the scenes, every fixture gets a numbered pin. */
export const FRONT: readonly FixtureKey[] = ["door", "boards", "till"];

export const PLATES = [
  {
    no: "I", title: "The front", script: "what guests see", zones: ["front", "cafe"],
    keys: ["door", "boards", "till"] as FixtureKey[],
    lede: "The door, the boards and the till. Everything a guest touches is drawn from the same API a partner would call.",
  },
  {
    no: "II", title: "The counter and the office", script: "what runs", zones: ["cafe", "office"],
    keys: ["scanner", "rail", "machine", "desk", "cabinet", "certificate", "clock", "van"] as FixtureKey[],
    lede: "Behind the counter, the rail and the machine make each order. Out back, the office keeps the shop honest and the van ships it.",
  },
  {
    no: "III", title: "The dining room and the pantry", script: "what's kept", zones: ["dining"],
    keys: ["pantry", "dining"] as FixtureKey[],
    lede: "The pantry is the database. The tables are where the load test found the shop's first limit.",
  },
] as const;
