/** Exact origins only: never trust a visitor-supplied host, referrer or message. */
export function linkConfig(env: Record<string, string | undefined>) {
  const origins = new Set<string>();
  for (const item of (env.OFFICIAL_SITE_ORIGINS || "").split(",")) {
    if (!item.trim()) continue;
    const url = new URL(item.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
        url.pathname !== '/' || url.search || url.hash) throw new Error('OFFICIAL_SITE_ORIGINS 必须是网站根地址');
    origins.add(url.origin);
  }
  let fallback: string | undefined;
  if (env.DEFAULT_SITE_ORIGIN?.trim()) {
    const url = new URL(env.DEFAULT_SITE_ORIGIN.trim());
    if (url.pathname !== '/' || url.search || url.hash || url.username || url.password || !origins.has(url.origin))
      throw new Error('DEFAULT_SITE_ORIGIN 必须属于 OFFICIAL_SITE_ORIGINS');
    fallback = url.origin;
  }
  return { origins, fallback };
}

export function visitorOrigin(pages: unknown, config: ReturnType<typeof linkConfig>) {
  if (!Array.isArray(pages)) return config.fallback;
  const candidates = pages.flatMap((page: any, index) => {
    try {
      const url = new URL(page.page_url);
      if (url.username || url.password || !config.origins.has(url.origin)) return [];
      return [{origin:url.origin, timestamp:Number(page.timestamp) || 0, index}];
    } catch { return []; }
  });
  candidates.sort((a,b) => b.timestamp - a.timestamp || a.index - b.index);
  return candidates[0]?.origin || config.fallback;
}

/** Expand root-relative paths in plain text, code spans and Markdown links.
 * Existing absolute URLs and protocol-relative URLs are left untouched.
 */
export function expandKnowledgeLinks(text: string, origin?: string) {
  if (!origin) return text;
  return text.replace(/(^|[\s(（:：`>"'])\/(?!\/)([A-Za-z0-9_-][A-Za-z0-9_\-/.?=&%+#~]*)(?=$|[^A-Za-z0-9_\-/.?=&%+#~])/gm,
    (_match, prefix, path: string) => {
      // Keep sentence punctuation outside the URL.
      const clean = path.replace(/[.]+$/, '');
      if (!clean) return _match;
      try {
        const url = new URL('/' + clean, origin);
        if (url.origin !== origin) return _match;
        return prefix + url.href + path.slice(clean.length);
      } catch { return _match; }
    });
}
