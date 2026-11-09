const RESULTS = new Set(["1-0", "0-1", "1/2-1/2", "*", "½-½"]);

/** Parse the PGN tag-pair section into a map (stops at the first movetext line). */
export function parsePgnHeaders(pgn: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const text = pgn.charCodeAt(0) === 0xfeff ? pgn.slice(1) : pgn;
  const re = /^\s*\[\s*([A-Za-z0-9_]+)\s+"((?:[^"\\]|\\.)*)"\s*\]\s*$/;
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (t === "" || t.startsWith("%")) continue;
    const m = re.exec(t);
    if (!m) break;
    headers[m[1]] = m[2].replace(/\\(["\\])/g, "$1");
  }
  return headers;
}

function stripHeaders(pgn: string): string {
  const lines = pgn.split(/\r?\n/);
  let i = 0;
  for (; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === "" || t.startsWith("%") || /^\[\s*[A-Za-z0-9_]+\s+".*"\s*\]$/.test(t)) continue;
    break;
  }
  return lines.slice(i).join("\n");
}

function cleanToken(raw: string): string | null {
  let tok = raw;
  if (tok.startsWith("$")) return null; // NAG
  if (RESULTS.has(tok)) return null;
  tok = tok.replace(/^\d+\.+/, ""); // move number, possibly glued to the move
  tok = tok.replace(/^\.+/, "");
  if (tok === "" || RESULTS.has(tok)) return null;
  tok = tok.replace(/[!?]+$/, ""); // annotations
  if (tok.startsWith("$")) return null;
  tok = tok.replace(/e\.p\.?$/, ""); // glued en-passant marker: "exd6e.p." -> "exd6"
  if (tok === "") return null;
  // Castling written with zeros or lower case: 0-0, o-o-o -> O-O, O-O-O.
  const castle = /^([0oO])-\1(-\1)?([+#]?)$/.exec(tok);
  if (castle) tok = (castle[2] ? "O-O-O" : "O-O") + castle[3];
  // Promotion without "=" or with a lower-case piece: e8Q, exd8q -> e8=Q, exd8=Q.
  tok = tok.replace(/^([a-h](?:x[a-h])?[18])=?([QRBNqrbn])([+#]?)$/, (_m, sq: string, pc: string, mark: string) => `${sq}=${pc.toUpperCase()}${mark}`);
  if (!/^[A-Za-z]/.test(tok) || !/^[A-Za-z0-9=+#-]+$/.test(tok)) return null;
  return tok;
}

/**
 * Extract the mainline SAN moves from a PGN string (single game) without replaying it.
 * Handles headers, {comments} (incl. [%clk]), ;comments, nested (variations), move numbers,
 * NAGs, !? annotations, "0-0" castling and result tokens.
 */
export function extractSanMoves(pgn: string): string[] {
  const s = stripHeaders(pgn);
  const moves: string[] = [];
  const n = s.length;
  let depth = 0;
  let i = 0;
  let atLineStart = true;
  let tok = "";

  const flush = () => {
    if (tok !== "") {
      if (depth === 0) {
        const m = cleanToken(tok);
        if (m) moves.push(m);
      }
      tok = "";
    }
  };

  while (i < n) {
    const c = s[i];
    if (c === "{") {
      flush();
      const end = s.indexOf("}", i + 1);
      i = end === -1 ? n : end + 1;
      atLineStart = false;
    } else if (c === ";") {
      flush();
      const end = s.indexOf("\n", i);
      i = end === -1 ? n : end;
    } else if (c === "%" && atLineStart) {
      const end = s.indexOf("\n", i);
      i = end === -1 ? n : end;
    } else if (c === "(") {
      flush();
      depth++;
      i++;
      atLineStart = false;
    } else if (c === ")") {
      flush();
      if (depth > 0) depth--;
      i++;
      atLineStart = false;
    } else if (c === " " || c === "\t" || c === "\r" || c === "\n") {
      flush();
      atLineStart = c === "\n" ? true : atLineStart;
      i++;
    } else {
      tok += c;
      atLineStart = false;
      i++;
    }
  }
  flush();
  return moves;
}
