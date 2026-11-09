/** Shared helpers for importers. */

export function lastSegment(url: string): string {
  return url.replace(/\/+$/, "").split("/").pop() ?? "";
}

export function isoDateFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
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
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
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
