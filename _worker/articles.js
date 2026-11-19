export const site = "https://anthony-rosa.com";
export const searchName = "search_articles";
export const description = "Search Anthony Rosa's published blog articles by title and summary.";
export const maxQueryLength = 200;

export async function findArticles(query) {
  const response = await fetch(site + "/blog/", { headers: { Accept: "text/html" } });
  if (!response.ok) throw new Error("Blog index unavailable");

  // Read the same structured data that powers discovery on the public blog.
  const scripts = [];
  const collector = {
    element() { scripts.push(""); },
    text(chunk) { scripts[scripts.length - 1] += chunk.text; },
  };
  await new HTMLRewriter().on('script[type="application/ld+json"]', collector)
    .transform(response).arrayBuffer();
  const posts = scripts.flatMap(text => JSON.parse(text))
    .find(node => node.mainEntity?.["@type"] === "Blog")?.mainEntity.blogPost;
  if (!Array.isArray(posts)) throw new Error("Blog index is missing article metadata");

  const words = query.trim().toLowerCase().split(/\s+/);
  return posts.filter(post => {
    const text = (post.headline + " " + post.description).toLowerCase();
    return words.every(word => text.includes(word));
  }).map(({ headline: title, datePublished, description, url }) => ({ title, datePublished, description, url }));
}
