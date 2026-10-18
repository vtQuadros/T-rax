import { useCallback, useEffect, useState } from "react";
import { hunkPatch, parseDiff, type ParsedDiff } from "@/lib/diff";
import { ipc } from "@/lib/ipc";
import { useWorkspace } from "@/lib/store";
import { Button } from "./ui";

/** Unified diff of one file with hunk-level stage / unstage / discard. */
export function DiffView({ root, path, staged }: { root: string; path: string; staged: boolean }) {
  const fsVersion = useWorkspace((s) => s.fsVersion);
  const bumpFs = useWorkspace((s) => s.bumpFs);
  const [diff, setDiff] = useState<ParsedDiff | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    ipc
      .gitDiff(root, path, staged)
      .then((t) => setDiff(parseDiff(t)))
      .catch((e) => setError(String(e)));
  }, [root, path, staged]);

  useEffect(load, [load, fsVersion]);

  const apply = async (patch: string, cached: boolean, reverse: boolean) => {
    try {
      await ipc.gitApply(root, patch, cached, reverse);
      bumpFs();
    } catch (e) {
      setError(String(e));
    }
  };

  if (error) return <div className="selectable p-6 font-mono text-[12px] text-red">{error}</div>;
  if (!diff) return <div className="p-6 text-muted">Loading…</div>;
  if (!diff.hunks.length)
    return <div className="p-6 text-muted">No {staged ? "staged" : "unstaged"} changes in {path}.</div>;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center border-b border-border px-6 font-mono text-[12px] text-muted">
        {path.split("/").slice(0, -1).join(" / ")}
        {path.includes("/") && " / "}
        <span className="text-fg">{path.split("/").pop()}</span>
        <span className="ml-1">· {staged ? "staged" : "working tree"}</span>
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-auto px-6 py-5">
        {diff.hunks.map((h) => (
          <div key={h.header} className="overflow-hidden rounded-[10px] border border-border-strong">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-elevated py-1.5 pr-2 pl-3.5">
              <span className="font-mono text-[12px] text-muted">{h.header}</span>
              <div className="flex gap-1">
                {staged ? (
                  <Button onClick={() => apply(hunkPatch(diff, h), true, true)}>Unstage hunk</Button>
                ) : (
                  <>
                    <Button variant="ghost" onClick={() => confirm("Discard this hunk?") && apply(hunkPatch(diff, h), false, true)}>
                      Discard
                    </Button>
                    <Button onClick={() => apply(hunkPatch(diff, h), true, false)}>Stage hunk</Button>
                  </>
                )}
              </div>
            </div>
            <div className="selectable py-1.5 font-mono text-[13px] leading-[1.75]">
              {numberLines(h.header, h.lines).map(({ text, kind, n }, i) => (
                <div
                  key={i}
                  className={`flex px-3.5 whitespace-pre ${kind === "+" ? "bg-accent-soft text-green-200" : kind === "-" ? "bg-red-soft text-red-300" : "text-fg-soft"}`}
                >
                  <span className={`w-11 shrink-0 select-none ${kind === "+" ? "text-accent" : kind === "-" ? "text-red" : "text-dim"}`}>{n}</span>
                  <span className="w-[18px] shrink-0 select-none">{kind === "+" ? "+" : kind === "-" ? "−" : ""}</span>
                  <span>{text || " "}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Line numbers for a hunk: new-file numbers for context/additions, old ones for deletions. */
function numberLines(header: string, lines: string[]) {
  const m = header.match(/@@ -(\d+)(?:,\d+)? \+(\d+)/);
  let oldN = m ? +m[1] : 0;
  let newN = m ? +m[2] : 0;
  return lines.map((l) => {
    if (l[0] === "\\") return { kind: " ", n: "" as number | string, text: l };
    const kind = l[0] === "+" ? "+" : l[0] === "-" ? "-" : " ";
    const n = kind === "-" ? oldN++ : newN++;
    if (kind === " ") oldN++;
    return { kind, n, text: l.slice(1) };
  });
}

export function CommitView({ root, hash }: { root: string; hash: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    ipc.gitShow(root, hash).then(setText).catch((e) => setText(String(e)));
  }, [root, hash]);
  return (
    <pre className="selectable h-full overflow-auto p-4 font-mono text-[12px]">
      {text.split("\n").map((l, i) => (
        <div
          key={i}
          className={
            l.startsWith("+") && !l.startsWith("+++")
              ? "text-green"
              : l.startsWith("-") && !l.startsWith("---")
                ? "text-red"
                : l.startsWith("@@")
                  ? "text-cyan"
                  : l.startsWith("diff --git")
                    ? "mt-3 font-semibold text-fg"
                    : "text-fg/80"
          }
        >
          {l || " "}
        </div>
      ))}
    </pre>
  );
}
