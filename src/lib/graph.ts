import type { Commit } from "./ipc";

export type GraphRow = {
  commit: Commit;
  col: number;
  /** Segments in the top half: [fromLane, toLane] (toLane is where it lands at mid-row). */
  top: [number, number][];
  /** Segments in the bottom half: [fromLaneAtMid, toLane]. */
  bottom: [number, number][];
  width: number;
};

/** Assigns each commit (in topo order) a lane, git-log-graph style. */
export function layoutGraph(commits: Commit[]): GraphRow[] {
  let lanes: (string | null)[] = [];
  const rows: GraphRow[] = [];
  for (const c of commits) {
    let col = lanes.indexOf(c.hash);
    if (col === -1) {
      col = lanes.indexOf(null);
      if (col === -1) col = lanes.push(null) - 1;
      lanes[col] = c.hash;
    }
    const top: [number, number][] = [];
    lanes.forEach((h, i) => {
      if (h == null) return;
      top.push([i, h === c.hash ? col : i]);
    });
    // Children converging on this commit end here.
    const next = lanes.map((h) => (h === c.hash ? null : h));
    const bottom: [number, number][] = [];
    const [first, ...rest] = c.parents;
    if (first) {
      const existing = next.indexOf(first);
      if (existing === -1) {
        next[col] = first;
        bottom.push([col, col]);
      } else bottom.push([col, existing]);
    }
    for (const p of rest) {
      let j = next.indexOf(p);
      if (j === -1) {
        j = next.indexOf(null);
        if (j === -1) j = next.push(null) - 1;
        next[j] = p;
      }
      bottom.push([col, j]);
    }
    // Lanes passing straight through this row.
    next.forEach((h, i) => {
      if (h != null && lanes[i] != null && lanes[i] !== c.hash) bottom.push([i, i]);
    });
    while (next.length && next[next.length - 1] == null) next.pop();
    rows.push({ commit: c, col, top, bottom, width: Math.max(lanes.length, next.length, col + 1) });
    lanes = next;
  }
  return rows;
}

export const LANE_COLORS = ["var(--c-blue)", "var(--c-magenta)", "var(--c-green)", "var(--c-yellow)", "var(--c-cyan)", "var(--c-red)"];
