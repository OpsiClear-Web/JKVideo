/**
 * Compare two semver-ish version strings (e.g. "v1.2.3" or "1.2.3").
 *
 * Returns 1 if a > b, -1 if a < b, 0 if equal. Compares the first three numeric
 * segments (major.minor.patch). A leading "v" is stripped. Missing segments count as
 * 0, so "1.2" === "1.2.0". Non-numeric segments become NaN, and since NaN comparisons
 * are always false they neither advance nor regress the result at that position — so
 * feed it clean numeric versions (the GitHub release tags are).
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1;
  }
  return 0;
}
