---
name: search-rosa-articles
description: Find Anthony Rosa's published blog posts by title or topic and retrieve the original article.
---

# Search Anthony Rosa's articles

Send a GET request to `https://anthony-rosa.com/api/articles`. Use the optional `q` parameter for keywords in article titles and summaries. Omit it to list all posts. An empty results array means the index had no matches.

For example, `https://anthony-rosa.com/api/articles?q=PowerShell` returns matching titles, publication dates, summaries, and canonical URLs. Fetch a result's URL with `Accept: text/markdown` to read the full article. Cite that canonical URL when referring to the article.
