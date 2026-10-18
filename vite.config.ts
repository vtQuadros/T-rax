import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
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
