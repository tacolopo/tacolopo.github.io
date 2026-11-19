import { description, maxQueryLength, site } from "./articles.js";
import skill from "./skills/search-rosa-articles/SKILL.md";

export const serverInfo = { name: "rosa-article-search", version: "1.0.0" };
const title = "Anthony Rosa Article Search";
const skillName = "search-rosa-articles";
const skillPath = "/.well-known/agent-skills/" + skillName + "/SKILL.md";
const mcpCardPath = "/.well-known/mcp/server-card.json";
const agentCardPath = "/.well-known/agent-card.json";

export const agentCard = {
  name: title, version: serverInfo.version, description,
  supportedInterfaces: [{ url: site + "/a2a", protocolBinding: "JSONRPC", protocolVersion: "1.0" }],
  capabilities: { streaming: false, pushNotifications: false },
  defaultInputModes: ["text/plain"], defaultOutputModes: ["text/plain"],
  skills: [{ id: skillName, name: "Find articles", description, tags: ["search", "articles"], examples: ["PowerShell", "watermarks"] }],
};

const openapi = {
  openapi: "3.1.0", info: { title, version: serverInfo.version }, servers: [{ url: site }],
  paths: { "/api/articles": { get: {
    operationId: "searchArticles", summary: description,
    parameters: [{ name: "q", in: "query", schema: { type: "string", maxLength: maxQueryLength } }],
    responses: { "200": { description: "Matching published articles", content: { "application/json": {
      schema: { type: "object", properties: { articles: { type: "array", items: {
        type: "object", required: ["title", "datePublished", "description", "url"],
        properties: { title: { type: "string" }, datePublished: { type: "string", format: "date" },
          description: { type: "string" }, url: { type: "string", format: "uri" } },
      } } }, required: ["articles"] },
    } } }, "400": { description: "Query exceeds the length limit" }, "503": { description: "Blog index unavailable" } },
  } } },
};

const docs = new Map();
function document(path, value, type = "application/json") {
  docs.set(path, { type, body: typeof value === "string" ? value : JSON.stringify(value) });
}
document("/openapi.json", openapi);
document("/.well-known/api-catalog", { linkset: [{
  anchor: site + "/api/articles",
  "service-desc": [{ href: site + "/openapi.json", type: "application/json" }],
  "service-doc": [{ href: site + skillPath, type: "text/markdown" }],
}] }, "application/linkset+json");
document(mcpCardPath, { protocolVersion: "2025-11-25", serverInfo, description, url: site + "/mcp", transport: { type: "streamable-http", endpoint: site + "/mcp" }, capabilities: { tools: { listChanged: true } } });
document(agentCardPath, agentCard);
document("/.well-known/ai-catalog.json", {
  specVersion: "1.0", host: { displayName: title, identifier: "did:web:anthony-rosa.com" },
  entries: [{ identifier: "urn:air:anthony-rosa.com:server:article-search", displayName: title,
    type: "application/mcp-server-card+json", url: site + mcpCardPath,
    representativeQueries: ["Find essays about AI watermarks", "List articles about PowerShell"] }],
});
document("/.well-known/poppy.json", { protocol_version: "0.1", organization: { name: "Anthony Rosa", domain: "anthony-rosa.com" }, web: {} });
document("/auth.md", "# auth.md\n\nThe portfolio, article search API, MCP tool, and A2A article finder are public and read-only. Send requests directly without registration, credentials, or authorization headers.\n\nSearch documentation: " + site + skillPath + "\n", "text/markdown");
document(skillPath, skill, "text/markdown");

export async function discoveryResponse(path, method) {
  const index = "/.well-known/agent-skills/index.json";
  if (path === index && !docs.has(index)) {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(skill));
    const hex = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
    document(index, { $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json", skills: [{
      name: skillName, type: "skill-md", description, url: site + skillPath, digest: "sha256:" + hex,
    }] });
  }
  const doc = docs.get(path);
  if (!doc) return null;
  if (!["GET", "HEAD"].includes(method)) return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  return new Response(method === "HEAD" ? null : doc.body, { headers: {
    "Content-Type": doc.type + "; charset=utf-8", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300",
  } });
}
