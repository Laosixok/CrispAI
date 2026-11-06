/** Bounded single-process cache with concurrent request coalescing and short failure caching. */
export function requestCache<T>(ttl = 300000, max = 1000, failureTtl = 30000) {
  const entries = new Map<string, {until:number; value:Promise<T>}>();
  return (key: string, fetcher: () => Promise<T>): Promise<T> => {
    const now = Date.now();
    const hit = entries.get(key);
    if (hit && hit.until > now) return hit.value;
    entries.delete(key);
    while (entries.size >= max) entries.delete(entries.keys().next().value!);
    const entry = {until:now + ttl, value:Promise.resolve().then(fetcher)};
    entry.value = entry.value.catch(error => {
      entry.until = Date.now() + failureTtl;
      throw error;
    });
    entries.set(key, entry);
    return entry.value;
  };
}
