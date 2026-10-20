import { Channel, invoke } from "@tauri-apps/api/core";

export type DirEntry = { name: string; path: string; isDir: boolean };
export type GrepMatch = { path: string; line: number; text: string };
export type FileChange = { path: string; status: string; staged: boolean };
export type GitStatus = {
  root: string;
  branch: string;
  upstream: string | null;
  ahead: number;
  behind: number;
  changes: FileChange[];
};
export type Commit = {
  hash: string;
  parents: string[];
  author: string;
  date: number;
  subject: string;
  refs: string[];
};
export type RunResult = { stdout: string; stderr: string; code: number | null; timedOut: boolean };
export type PtyEvent = { type: "data"; data: string } | { type: "exit" };
export type AiEvent = { type: "status"; status: number } | { type: "chunk"; data: string };

export const ipc = {
  home: () => invoke<string>("workspace_home"),
  launchDir: () => invoke<string | null>("workspace_launch_dir"),

  ptyOpen(cols: number, rows: number, cwd: string | undefined, onEvent: (e: PtyEvent) => void) {
    const ch = new Channel<PtyEvent>();
    ch.onmessage = onEvent;
    return invoke<number>("pty_open", { cols, rows, cwd, onEvent: ch });
  },
  ptyWrite: (id: number, data: string) => invoke<void>("pty_write", { id, data }),
  ptyResize: (id: number, cols: number, rows: number) => invoke<void>("pty_resize", { id, cols, rows }),
  ptyClose: (id: number) => invoke<void>("pty_close", { id }),
  ptyCwd: (id: number) => invoke<string | null>("pty_cwd", { id }),

  readDir: (path: string, showHidden = false) => invoke<DirEntry[]>("fs_read_dir", { path, showHidden }),
  readFile: (path: string) => invoke<string>("fs_read_file", { path }),
  writeFile: (path: string, content: string) => invoke<void>("fs_write_file", { path, content }),
  createFile: (path: string) => invoke<void>("fs_create_file", { path }),
  createDir: (path: string) => invoke<void>("fs_create_dir", { path }),
  rename: (from: string, to: string) => invoke<void>("fs_rename", { from, to }),
  remove: (path: string) => invoke<void>("fs_delete", { path }),
  stat: (path: string) => invoke<{ size: number; modified: number }>("fs_stat", { path }),
  mediaAllow: (path: string) => invoke<void>("media_allow", { path }),
  openDefault: (path: string) => invoke<void>("open_default", { path }),
  searchFiles: (root: string, query: string, limit?: number) => invoke<string[]>("fs_search", { root, query, limit }),
  grep: (root: string, query: string, opts: { regex?: boolean; caseSensitive?: boolean; limit?: number } = {}) =>
    invoke<GrepMatch[]>("fs_grep", { root, query, ...opts }),

  gitStatus: (cwd: string) => invoke<GitStatus | null>("git_status", { cwd }),
  gitDiff: (root: string, path: string, staged: boolean) => invoke<string>("git_diff", { root, path, staged }),
  gitFileAt: (root: string, path: string, rev?: string) => invoke<string>("git_file_at_head", { root, path, rev }),
  gitStage: (root: string, paths: string[]) => invoke<void>("git_stage", { root, paths }),
  gitUnstage: (root: string, paths: string[]) => invoke<void>("git_unstage", { root, paths }),
  gitDiscard: (root: string, path: string, untracked: boolean) => invoke<void>("git_discard", { root, path, untracked }),
  gitCommit: (root: string, message: string, all: boolean) => invoke<string>("git_commit", { root, message, all }),
  gitPush: (root: string) => invoke<string>("git_push", { root }),
  gitLog: (root: string, query?: string, limit?: number) => invoke<Commit[]>("git_log", { root, query, limit }),
  gitBranch: (cwd: string) => invoke<string | null>("git_branch", { cwd }),
  gitShow: (root: string, hash: string) => invoke<string>("git_show", { root, hash }),
  gitApply: (root: string, patch: string, cached: boolean, reverse: boolean) =>
    invoke<void>("git_apply", { root, patch, cached, reverse }),

  run: (command: string, cwd: string, timeoutSecs?: number) => invoke<RunResult>("shell_run", { command, cwd, timeoutSecs }),

  aiStream(
    requestId: string,
    url: string,
    headers: Record<string, string>,
    body: string,
    onEvent: (e: AiEvent) => void,
  ) {
    const ch = new Channel<AiEvent>();
    ch.onmessage = onEvent;
    return invoke<void>("ai_stream", { requestId, url, headers, body, onEvent: ch });
  },
  aiCancel: (requestId: string) => invoke<void>("ai_cancel", { requestId }),
};

export const basename = (p: string) => p.replace(/\/+$/, "").split("/").pop() || p;
export const dirname = (p: string) => p.replace(/\/[^/]*\/?$/, "") || "/";
export const joinPath = (a: string, b: string) => (b.startsWith("/") ? b : `${a.replace(/\/+$/, "")}/${b}`);
export const relPath = (root: string, p: string) => (p.startsWith(root + "/") ? p.slice(root.length + 1) : p);
