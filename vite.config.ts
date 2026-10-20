import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";

/** Dev-only: logs requests and receives webview errors posted to /__log. */
const devLog = (): Plugin => ({
  name: "dev-log",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === "/__log" && req.method === "POST") {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          console.log(`[webview] ${body}`);
          res.end("ok");
        });
        return;
      }
      // Mock-backend media fixtures: files by bare name from $DEV_FIXTURES only.
      if (req.url?.startsWith("/__dev_file?") && process.env.DEV_FIXTURES) {
        const name = new URL(req.url, "http://x").searchParams.get("name") ?? "";
        if (!/^[\w.-]+$/.test(name)) return void res.writeHead(400).end();
        try {
          const types: Record<string, string> = { svg: "image/svg+xml", png: "image/png", pdf: "application/pdf" };
          const type = types[name.split(".").pop() ?? ""];
          if (type) res.setHeader("Content-Type", type);
          return void res.end(readFileSync(`${process.env.DEV_FIXTURES}/${name}`));
        } catch {
          return void res.writeHead(404).end();
        }
      }
      if (process.env.DEV_LOG_REQUESTS) console.log(`[req] ${req.method} ${req.url} ${req.headers["user-agent"]?.slice(0, 60) ?? ""}`);
      next();
    });
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), devLog()],
  clearScreen: false,
  resolve: { alias: { "@": "/src" } },
  server: { port: 1420, strictPort: true, watch: { ignored: ["**/src-tauri/**"] } },
  build: { target: "es2022", chunkSizeWarningLimit: 4000 },
});
