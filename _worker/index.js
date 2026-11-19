import Negotiator from "negotiator";
import { NodeHtmlMarkdown } from "node-html-markdown";

const converter = new NodeHtmlMarkdown({ ignore: ["head", "footer", "nav"] });
const discovery = '</llms.txt>; rel="describedby"; type="text/plain"';

export default {
  async fetch(request) {
    if (!["GET", "HEAD"].includes(request.method)) return fetch(request);

    const accept = request.headers.get("Accept") || "*/*";
    const negotiator = new Negotiator({ headers: { accept } });
    const markdown = negotiator.mediaTypes().includes("text/markdown") &&
      negotiator.mediaType(["text/html", "text/markdown"]) === "text/markdown";

    // The origin only knows the HTML representation and its validators.
    const origin = new Request(request);
    if (markdown) {
      origin.headers.set("Accept", "text/html");
      for (const key of ["If-None-Match", "If-Modified-Since", "Range", "If-Range"]) {
        origin.headers.delete(key);
      }
    }
    const response = await fetch(origin);
    const headers = new Headers(response.headers);
    if (response.status === 304) {
      headers.append("Vary", "Accept, Signature-Input");
      return new Response(null, { status: 304, headers });
    }
    if (response.status !== 200 || !headers.get("Content-Type")?.startsWith("text/html")) {
      return response;
    }

    headers.append("Vary", "Accept, Signature-Input");
    headers.append("Link", discovery);
    if (markdown) {
      const body = request.method === "HEAD" ? null : converter.translate(await response.text()) + "\n";
      headers.set("Content-Type", "text/markdown; charset=utf-8");
      for (const key of ["Content-Length", "Content-Encoding", "ETag", "Accept-Ranges", "Last-Modified"]) {
        headers.delete(key);
      }
      return new Response(body, { headers });
    }

    // Signed browsers send signature headers on subresource requests. The RUM
    // beacon's cross-origin preflight rejects them. Keep RUM for ordinary visits.
    if (request.headers.has("Signature-Input")) {
      headers.set("Cache-Control", "private, no-store, no-transform");
      headers.delete("Content-Length");
      headers.delete("ETag");
      const html = new Response(response.body, { headers });
      if (request.method === "HEAD") return html;
      return new HTMLRewriter()
        .on('script[src^="https://static.cloudflareinsights.com/beacon.min.js"]', {
          element(element) { element.remove(); }
        })
        .transform(html);
    }
    return new Response(response.body, { headers });
  }
};
