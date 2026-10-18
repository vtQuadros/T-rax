export type Hunk = { header: string; lines: string[] };
export type ParsedDiff = { fileHeader: string[]; hunks: Hunk[] };

export function parseDiff(text: string): ParsedDiff {
  const fileHeader: string[] = [];
  const hunks: Hunk[] = [];
  for (const line of text.split("\n")) {
    if (line.startsWith("@@")) hunks.push({ header: line, lines: [] });
    else if (hunks.length) {
      if (line === "" ) continue;
      hunks[hunks.length - 1].lines.push(line);
    } else if (line) fileHeader.push(line);
  }
  return { fileHeader, hunks };
}

export function hunkPatch(d: ParsedDiff, h: Hunk) {
  return [...d.fileHeader, h.header, ...h.lines, ""].join("\n");
}
