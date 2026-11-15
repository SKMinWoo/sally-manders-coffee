import type { Metadata } from "next";
import { openApiDocument } from "@/server/api/openapi";
import s from "./docs.module.css";

export const metadata: Metadata = { title: "The API" };

type JsonSchema = {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  enum?: string[];
  format?: string;
};

/** "integer or null", "array of objects", "date": a schema's type, the way a person says it. */
function typeOf(p: JsonSchema): string {
  if (p.anyOf) return p.anyOf.map(typeOf).join(" or ");
  if (p.enum) return p.enum.map((e) => `"${e}"`).join(" | ");
  if (p.type === "array") return `array of ${p.items ? typeOf(p.items) : "any"}`;
  if (p.format === "date-time") return "date-time";
  if (p.format === "date") return "date";
  return Array.isArray(p.type) ? p.type.join(" or ") : (p.type ?? "any");
}

function Fields({ schema }: { schema: JsonSchema }) {
  const props = schema.properties ?? {};
  return (
    <table className={s.fields}>
      <tbody>
        {Object.entries(props).map(([name, p]) => (
          <tr key={name}>
            <th scope="row"><code>{name}</code>{!schema.required?.includes(name) && <span className={s.opt}> optional</span>}</th>
            <td className={s.type}>{typeOf(p)}</td>
            <td>{p.description ?? p.anyOf?.find((a) => a.description)?.description ?? (p.type === "array" && p.items?.properties ? `each: ${Object.keys(p.items.properties).join(", ")}` : "")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The API's reference, rendered from the same OpenAPI document /api/v1/openapi.json serves. */
export default function Docs() {
  const doc = openApiDocument();
  const schemas = doc.components.schemas as Record<string, JsonSchema>;
  return (
    <main className={s.page}>
      <p className="cond" style={{ color: "var(--teal)" }}>Read-only · v{doc.info.version}</p>
      <h1 className={`script ${s.title}`}>The figures, open</h1>
      <p className={s.lede}>{doc.info.description}</p>
      <p className={s.lede}>
        The machine-readable version is <a href="/api/v1/openapi.json">/api/v1/openapi.json</a> (OpenAPI 3.1), generated
        from the same schemas every response is checked against before it leaves. Errors come back as{" "}
        <code>application/problem+json</code>.
      </p>

      {Object.entries(doc.paths).map(([path, item]) => {
        const op = item.get;
        const ok = op.responses["200"].content["application/json"].schema.$ref.split("/").pop()!;
        const example = `/api/v1${path.replace("{date}", "today")}`;
        return (
          <section key={path} className={s.endpoint} aria-labelledby={`ep-${ok}`}>
            <h2 id={`ep-${ok}`} className={s.path}>
              <span className={s.get}>GET</span> <code>/api/v1{path}</code>
            </h2>
            <p className={s.summary}>{op.summary}</p>
            {"description" in op && <p className={s.desc}>{op.description}</p>}
            <p className={s.try}>
              Try it: <a href={example}>{example}</a>
            </p>
            <Fields schema={schemas[ok]!} />
          </section>
        );
      })}
    </main>
  );
}
