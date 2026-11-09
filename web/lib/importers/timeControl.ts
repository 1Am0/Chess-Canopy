function pyInt(s: string): number | null {
  // Python int(): optional whitespace and sign around decimal digits.
  return /^\s*[+-]?\d+\s*$/.test(s) ? parseInt(s, 10) : null;
}

/** Port of import_games.time_control_label: map a raw time control to bullet/blitz/rapid/classical/daily. */
export function timeControlLabel(tc: string | null | undefined): string {
  if (!tc) return "rapid";
  if (tc.includes("/")) return "daily";
  const parts = tc.split("+");
  const base = pyInt(parts[0]);
  const inc = parts.length > 1 ? pyInt(parts[1]) : 0;
  if (base === null || inc === null) return "rapid";
  const total = base + 40 * inc;
  if (total >= 86400) return "daily";
  if (total < 180) return "bullet";
  if (total < 600) return "blitz";
  if (total < 3600) return "rapid";
  return "classical";
}
