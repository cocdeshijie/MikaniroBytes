/** Nicely truncate long filenames for the tile label */
export function shortenFilename(full: string, limit = 26): string {
  if (full.length <= limit) return full;
  const dot = full.lastIndexOf(".");
  const ext = dot !== -1 ? full.slice(dot) : "";
  const base = dot !== -1 ? full.slice(0, dot) : full;
  const tail = Math.min(4, base.length);
  const avail = limit - ext.length - 3 - tail;
  if (avail <= 0) return base.slice(0, 1) + "…" + ext;
  return base.slice(0, avail) + "…" + base.slice(-tail) + ext;
}
