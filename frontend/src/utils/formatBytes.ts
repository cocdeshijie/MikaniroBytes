/**
 * Utilities for binary-based size conversions.
 *
 * • sizeToBytes(input: string): parse strings like "5 MB", "2 gb", "10kb"
 *   in binary (1024) multiples → number of bytes or null if blank / invalid.
 * • formatBytes(bytes: number): produce a human-readable string in binary style.
 *   e.g. 1234567 => "1.18 MB"
 */

/** Convert textual input → bytes (binary-based).
 *
 *  Examples:
 *    "10 mb" => 10,485,760
 *    "1 GB"  => 1,073,741,824
 *    "1kb"   => 1,024
 *  Returns null if empty or invalid.
 */
export function sizeToBytes(input: string): number | null {
  const txt = input.trim().toLowerCase();
  if (!txt) return null; // blank => unlimited

  // e.g. "10 mb"
  const m = txt.match(/^([\d.,]+)\s*(b|kb|mb|gb|tb)?$/);
  if (!m) return null;
  const num = parseFloat(m[1].replace(",", "."));
  if (isNaN(num)) return null;

  // Binary multipliers
  const mult: Record<string, number> = {
    b:   1,
    kb:  1024,
    mb:  1024 ** 2,
    gb:  1024 ** 3,
    tb:  1024 ** 4,
  };

  const unit = m[2] ?? "b";
  const factor = mult[unit] ?? 1;

  return Math.round(num * factor);
}

/** Convert bytes → human-readable string (binary-based).
 *  Example: 1,234,567 => "1.18 MB"  (1 MB = 1,048,576 bytes)
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return bytes + " B";
  }
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let exponent = Math.floor(Math.log(bytes) / Math.log(1024));
  if (exponent >= units.length) {
    exponent = units.length - 1;
  }
  const unit = units[exponent];
  const val = (bytes / Math.pow(1024, exponent)).toFixed(2);
  return `${val} ${unit}`;
}
