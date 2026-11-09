/** Shared helpers for importers. */

export function lastSegment(url: string): string {
  return url.replace(/\/+$/, "").split("/").pop() ?? "";
}

export function isoDateFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * The last path segment of an http(s) URL ("https://lichess.org/abcd1234" -> "abcd1234"),
 * or null when `value` is not an http(s) URL or has no path (e.g. "Chess.com", "London ENG",
 * "https://lichess.org/").
 */
export function urlGameId(value: string | null | undefined): string | null {
  if (!value || !/^https?:\/\//i.test(value.trim())) return null;
  try {
    const u = new URL(value.trim());
    const seg = u.pathname.replace(/\/+$/, "").split("/").pop() ?? "";
    return seg ? decodeURIComponent(seg) : null;
  } catch {
    return null;
  }
}

/**
 * 64-bit content hash as 16 hex chars (two independent 32-bit FNV-1a style lanes).
 * Used for stable game ids when a file carries no URL, so ids never collide across
 * games or files the way positional ids ("pgn-1") or Event names did.
 */
export function hash64(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
    h2 ^= h2 >>> 15;
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 0x85ebca6b);
  h2 = Math.imul(h2 ^ (h2 >>> 13), 0xc2b2ae35);
  return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}

/** Python int(): optional whitespace and sign around decimal digits; otherwise null. */
export function pyInt(s: string | null | undefined): number | null {
  return s != null && /^\s*[+-]?\d+\s*$/.test(s) ? parseInt(s, 10) : null;
}

/** Parse a PGN date "YYYY.MM.DD" like Python strptime; null if invalid (e.g. "????.??.??"). */
export function parsePgnDate(value: string): string | null {
  const m = /^(\d{1,4})\.(\d{1,2})\.(\d{1,2})$/.exec(value);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(2000, mo - 1, d));
  dt.setUTCFullYear(y);
  if (y < 1 || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export class HttpError extends Error {
  status: number;
  /** Short response body text, when the server sent one (e.g. chess.com's 403 reason). */
  body: string;
  constructor(status: number, message: string, body = "") {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

export function abortError(): Error {
  const e = new Error("Aborted");
  e.name = "AbortError";
  return e;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
