const modelContext = document.modelContext ?? navigator.modelContext;
if (modelContext?.registerTool) {
  modelContext.registerTool({
    name: "search_articles",
    description: "Find Anthony Rosa's blog articles by keywords in their titles and summaries.",
    inputSchema: { type: "object", properties: { query: { type: "string", maxLength: 200 } } },
    async execute({ query = "" }) {
      const url = new URL("/api/articles", location.origin);
      url.searchParams.set("q", query);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Article search unavailable");
      return { content: [{ type: "text", text: JSON.stringify(await response.json()) }] };
    },
  });
}
