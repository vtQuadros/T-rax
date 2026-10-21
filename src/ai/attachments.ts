import { convertFileSrc } from "@tauri-apps/api/core";
import { basename, ipc, relPath } from "@/lib/ipc";
import { newId, useWorkspace } from "@/lib/store";

export type Attachment = {
  id: string;
  path: string;
  name: string;
  kind: "image" | "pdf" | "text";
  size: number;
};

export type ImagePart = { mime: string; data: string };

// Formats the vision APIs (OpenAI, Anthropic) accept; other images go in as a path.
const VISION_MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };
const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_PDF_CHARS = 60_000;
const MAX_TEXT_CHARS = 100_000;

export async function toAttachment(path: string): Promise<Attachment | null> {
  const st = await ipc.stat(path).catch(() => null);
  if (!st || st.isDir) return null; // folders and unreadable paths are skipped
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const kind = ext === "pdf" ? "pdf" : VISION_MIME[ext] ? "image" : "text";
  return { id: newId("att"), path, name: basename(path), kind, size: st.size };
}

/** Turns attachments into extra prompt text plus image parts for the provider. */
export async function prepareAttachments(atts: Attachment[]): Promise<{ text: string; images: ImagePart[] }> {
  const root = useWorkspace.getState().root;
  const blocks: string[] = [];
  const images: ImagePart[] = [];
  for (const a of atts) {
    const shown = relPath(root, a.path);
    try {
      if (a.kind === "image") {
        if (a.size > MAX_IMAGE) throw new Error("image larger than 5 MB");
        const ext = a.path.split(".").pop()!.toLowerCase();
        images.push({ mime: VISION_MIME[ext], data: await ipc.readBase64(a.path, MAX_IMAGE) });
        blocks.push(`<attached-image path="${shown}" />`);
      } else if (a.kind === "pdf") {
        const text = await pdfText(a.path, MAX_PDF_CHARS);
        blocks.push(`<attached-file path="${shown}" type="pdf">\n${text}\n</attached-file>`);
      } else {
        const text = await ipc.readFile(a.path);
        const clipped = text.length > MAX_TEXT_CHARS ? `${text.slice(0, MAX_TEXT_CHARS)}\n… (truncated)` : text;
        blocks.push(`<attached-file path="${shown}">\n${clipped}\n</attached-file>`);
      }
    } catch (e) {
      // Binary or unreadable: the agent still gets the path and can use its tools.
      blocks.push(`<attached-file path="${shown}" note="content not included: ${String(e).slice(0, 120)}" />`);
    }
  }
  return { text: blocks.join("\n\n"), images };
}

async function pdfText(path: string, maxChars: number) {
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  GlobalWorkerOptions.workerSrc = workerUrl;
  await ipc.mediaAllow(path);
  const data = new Uint8Array(await (await fetch(convertFileSrc(path))).arrayBuffer());
  const task = getDocument({ data });
  try {
    const doc = await task.promise;
    let out = "";
    for (let n = 1; n <= doc.numPages && out.length < maxChars; n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      out += `\n--- page ${n} ---\n${content.items.map((it) => ("str" in it ? it.str : "")).join(" ")}`;
    }
    return out.length > maxChars ? `${out.slice(0, maxChars)}\n… (truncated)` : out;
  } finally {
    void task.destroy();
  }
}

export function formatSize(n: number) {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}
