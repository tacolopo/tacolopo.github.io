import { createMcpHandler, McpServer, originValidationResponse, readRequestBody } from "@modelcontextprotocol/server";
import { AgentCard, Message } from "@a2a-js/sdk";
import { AgentEvent, DefaultRequestHandler, InMemoryTaskStore, JsonRpcTransportHandler, ServerCallContext } from "@a2a-js/sdk/server";
import { TaskNotFoundError, UnsupportedOperationError } from "@a2a-js/sdk/errors";
import { z } from "zod";
import { findArticles, description, maxQueryLength, searchName } from "./articles.js";
import { agentCard, serverInfo } from "./discovery.js";

const maxBody = 16 * 1024;
const mcp = createMcpHandler(() => {
  const server = new McpServer(serverInfo);
  server.registerTool(searchName, {
    description, inputSchema: z.object({ query: z.string().max(maxQueryLength).default("") }),
    annotations: { readOnlyHint: true, idempotentHint: true },
  }, async ({ query }) => ({
    content: [{ type: "text", text: JSON.stringify(await findArticles(query)) }],
  }));
  return server;
}, { maxRequestBodySize: maxBody, responseMode: "json" });

const executor = {
  async execute(context, bus) {
    const query = Message.toJSON(context.userMessage).parts.map(part => part.text ?? "").join(" ").trim();
    let text;
    if (!query || query.length > maxQueryLength) {
      text = "Send one or more article keywords, up to " + maxQueryLength + " characters.";
    } else {
      const articles = await findArticles(query);
      text = articles.map(article => article.title + "\n" + article.url).join("\n\n") || "No matching articles.";
    }
    bus.publish(AgentEvent.message(Message.fromJSON({
      messageId: crypto.randomUUID(), contextId: context.contextId,
      role: "ROLE_AGENT", parts: [{ text }],
    })));
    bus.finished();
  },
  async cancelTask(id) { throw new TaskNotFoundError(id); },
};

async function handleA2a(request) {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  if (request.headers.get("Content-Type")?.split(";")[0].trim() !== "application/json") {
    return new Response("Use application/json", { status: 415 });
  }
  const body = await readRequestBody(request, maxBody);
  if (body.tooLarge) return new Response(null, { status: 413 });
  // A search returns one immediate message. Each caller gets a fresh task store.
  const handler = new DefaultRequestHandler(AgentCard.fromJSON(agentCard), new InMemoryTaskStore(), executor);
  const rpc = new JsonRpcTransportHandler(handler);
  const context = new ServerCallContext({ requestedVersion: request.headers.get("A2A-Version") ?? "1.0" });
  const result = await rpc.handle(body.text, context);
  if (result[Symbol.asyncIterator]) {
    const { id } = JSON.parse(body.text);
    return Response.json({ jsonrpc: "2.0", id, error: JsonRpcTransportHandler.mapToJSONRPCError(new UnsupportedOperationError("Streaming is unavailable")) });
  }
  return Response.json(result);
}

export async function protocolResponse(request, url) {
  if (url.pathname === "/mcp") {
    return originValidationResponse(request, [url.hostname]) ?? mcp.fetch(request);
  }
  if (url.pathname === "/a2a") return handleA2a(request);
  if (url.pathname !== "/api/articles") return null;

  if (!["GET", "HEAD"].includes(request.method)) return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  const query = url.searchParams.get("q") ?? "";
  if (query.length > maxQueryLength) return Response.json({ error: "Query too long" }, { status: 400 });
  try {
    const articles = await findArticles(query);
    return new Response(request.method === "HEAD" ? null : JSON.stringify({ articles }), { headers: {
      "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*",
    } });
  } catch {
    return Response.json({ error: "Blog index unavailable" }, { status: 503 });
  }
}
