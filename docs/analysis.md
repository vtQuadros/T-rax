# How Terax was analyzed

Terax (terax.app, Apache-2.0, `crynta/terax-ai`) was studied with
[REA](https://github.com/morluto/rea) (`rea-agents` 6.5.0) and cross-checked against its public source.

## Shipped binary (v0.8.6 AppImage)

- `rea inspect-artifact usr/bin/terax`: a single 11.4 MB stripped x86-64 ELF (PIE).
  The frontend is embedded in the binary (Tauri asset bundle), no Electron/ASAR.
- `rea inspect-rust-binary`: Rust binary, no `cargo-auditable` metadata; rustc commit
  `8bab26f4…` inferred from embedded paths.
- Strings in the binary show the Tauri plugin surface: `opener`, `clipboard-manager`, `store`,
  `notification`, `os`, `process`, `updater`, `window-state`, `autostart`, `log`.

## Frontend (source, 717 files)

`rea analyze-javascript-application src/` parsed all 717 TS/TSX files (532k AST nodes, 0 parse failures)
into an application graph of 7,555 nodes / 9,930 import edges. Storage use is `localStorage` + IndexedDB;
no network endpoints besides model providers (calls are proxied by Rust: `ai_http_stream`).

### IPC surface (frontend → Rust)

~100 commands, grouped by module. T-rax implements the core of each group:

| Terax group | Examples | T-rax |
| --- | --- | --- |
| `pty_*` | `pty_open`, `pty_resize`, `pty_close`, `pty_stream_open` | `pty_open/write/resize/close` (portable-pty + Tauri Channel) |
| `fs_*` | `fs_read_dir`, `fs_grep`, `fs_search`, `fs_watch_add`, `fs_rename` | read/write/create/rename/delete, `fs_search` (fuzzy), `fs_grep` (ignore-aware) |
| `git_*` | `git_panel_snapshot`, `git_stage`, `git_commit`, `git_log`, `git_push` | status, diff, stage/unstage/discard, hunk apply, commit, push, log, show |
| `ai_*` | `ai_http_stream`, `ai_http_cancel`, `ai_session_save` | `ai_stream` / `ai_cancel` (reqwest streaming, cancellable) |
| `shell_*` | `shell_run_command`, `shell_bg_spawn` | `shell_run` (timeout, output clipping) |
| `secrets_*`, `lsp_*`, `history_*`, `wsl_*`, `control_*` | keychain, language servers, shell history | not implemented |

### Frontend modules

`terminal` (Ghostty-derived WebGPU renderer), `editor` (CodeMirror 6 + Vim + LSP), `explorer`
(Catppuccin icons), `source-control` + `git-history`, `ai` (Vercel AI SDK, many providers), `agents`,
`preview`, `theme` (17 palettes), `command-palette`, `spaces`, `tabs` (split panes), `settings`.

T-rax keeps the same shape with a smaller stack: xterm.js + WebGL instead of the Ghostty
renderer, a hand-written provider layer (OpenAI-compatible + Anthropic) instead of the AI SDK,
and zustand stores per concern.
