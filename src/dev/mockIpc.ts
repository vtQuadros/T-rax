// Browser-only fake backend so the UI can be developed with `npm run dev` outside Tauri.
import { mockIPC } from "@tauri-apps/api/mocks";

const files: Record<string, string> = {
  "/demo/README.md": "# Demo project\n\nOpened in the browser with a mocked backend.\n",
  "/demo/src/main.ts": 'import { greet } from "./lib";\n\nconsole.log(greet("T-rax"));\n',
  "/demo/src/lib.ts": "export function greet(name: string) {\n  return `Hello, ${name}!`;\n}\n",
  "/demo/package.json": '{\n  "name": "demo",\n  "scripts": { "dev": "vite" }\n}\n',
  "/demo/TRAX.md": "# Project memory\n\n- Use TypeScript strict mode.\n",
};
// Binary fixtures served by the dev server from $DEV_FIXTURES (see vite.config.ts).
const media = ["/demo/media/spec.pdf", "/demo/media/logo.png", "/demo/media/icon.svg"];

export function installMockIpc() {
  mockIPC((cmd, args: any) => {
    if (cmd === "fs_stat") return { size: 1024, modified: 1, isDir: !/\.[a-z0-9]+$/i.test(args.path) };
    if (cmd === "media_allow" || cmd === "open_default") return null;
    // The paperclip's file picker returns the media fixtures.
    if (cmd === "plugin:dialog|open") return ["/demo/media/spec.pdf", "/demo/media/logo.png"];
    // Keep the last model request so the UI can be checked without a real provider.
    if (cmd === "ai_stream") return void ((window as any).__lastAiBody = JSON.parse(args.body));
    if (cmd === "fs_read_base64")
      return fetch(`/__dev_file?name=${encodeURIComponent(args.path.split("/").pop())}`)
        .then((r) => r.arrayBuffer())
        .then((b) => btoa(String.fromCharCode(...new Uint8Array(b))));
    switch (cmd) {
      case "workspace_home":
        return "/demo";
      case "workspace_launch_dir":
        return "/demo";
      case "fs_read_dir": {
        const dir = args.path.replace(/\/$/, "");
        const names = new Map<string, boolean>();
        for (const p of [...Object.keys(files), ...media]) {
          if (!p.startsWith(dir + "/")) continue;
          const rest = p.slice(dir.length + 1).split("/");
          names.set(rest[0], rest.length > 1);
        }
        return [...names].map(([name, isDir]) => ({ name, path: `${dir}/${name}`, isDir })).sort((a, b) => +b.isDir - +a.isDir || a.name.localeCompare(b.name));
      }
      case "fs_read_file":
        if (args.path in files) return files[args.path];
        throw new Error("not found");
      case "fs_write_file":
        files[args.path] = args.content;
        return null;
      case "fs_search":
        return Object.keys(files).filter((p) => p.toLowerCase().includes(args.query.toLowerCase()));
      case "fs_grep":
        return Object.entries(files).flatMap(([path, t]) =>
          t.split("\n").flatMap((text, i) => (text.toLowerCase().includes(args.query.toLowerCase()) ? [{ path, line: i + 1, text }] : [])),
        );
      case "git_status":
        return { root: "/demo", branch: "main", upstream: "origin/main", ahead: 1, behind: 0, changes: [
          { path: "src/lib.ts", status: "M", staged: false },
          { path: "src/new.ts", status: "?", staged: false },
          { path: "README.md", status: "M", staged: true },
        ] };
      case "git_branch":
        return "main";
      case "git_log":
        return [
          { hash: "a1", parents: ["b2", "c3"], author: "dev", date: 1760000000, subject: "Merge feature/search", refs: ["HEAD -> main", "origin/main"] },
          { hash: "c3", parents: ["d4"], author: "dev", date: 1759990000, subject: "Add ripgrep-style search", refs: ["feature/search"] },
          { hash: "b2", parents: ["d4"], author: "dev", date: 1759980000, subject: "Tweak theme palette", refs: [] },
          { hash: "d4", parents: [], author: "dev", date: 1759970000, subject: "Initial commit", refs: ["tag: v0.1.0"] },
        ];
      case "git_diff":
        return "diff --git a/src/lib.ts b/src/lib.ts\n--- a/src/lib.ts\n+++ b/src/lib.ts\n@@ -1,3 +1,3 @@\n export function greet(name: string) {\n-  return 'Hi ' + name;\n+  return `Hello, ${name}!`;\n }\n";
      case "shell_run":
        return { stdout: "", stderr: "", code: 0, timedOut: false };
      case "pty_open":
        return 1;
      case "pty_cwd":
        // The real backend reads /proc/<pid>/cwd of the shell.
        return "/demo";
      default:
        return null;
    }
  });
  (window as any).__TAURI_INTERNALS__.convertFileSrc = (path: string) => `/__dev_file?name=${encodeURIComponent(path.split("/").pop()!)}`;
}
