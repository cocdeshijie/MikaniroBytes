/** Convert bytes into a human-readable string (1000-based).
 * Example: 12345678 => "12.3 MB"
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return bytes + " B";

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const exponent = Math.floor(Math.log(bytes) / Math.log(1000));
  const unit = units[exponent] ?? "B";
  const val = (bytes / Math.pow(1000, exponent)).toFixed(1);

  return `${val} ${unit}`;
}
