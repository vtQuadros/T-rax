import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { create } from "zustand";
import { useSettings } from "./store";

export const RELEASES_URL = "https://github.com/vtQuadros/T-rax/releases";

/** appimage: replaces itself in place · deb: owned by apt, so we only point to the new .deb */
export type InstallKind = "appimage" | "deb" | "manual";

type UpdateState = {
  current: string;
  kind: InstallKind;
  status: "idle" | "checking" | "available" | "downloading" | "ready" | "uptodate" | "error";
  version: string | null;
  notes: string;
  progress: number; // 0..1 while downloading
  error: string | null;
  /** Hidden for this session (the user can still open it from the status bar). */
  dismissed: boolean;
};

export const useUpdate = create<UpdateState>(() => ({
  current: "",
  kind: "manual",
  status: "idle",
  version: null,
  notes: "",
  progress: 0,
  error: null,
  dismissed: false,
}));

let pending: Update | null = null;

export async function initUpdater() {
  try {
    const [current, kind] = await Promise.all([getVersion(), invoke<InstallKind>("install_kind")]);
    useUpdate.setState({ current, kind });
  } catch {
    return; // not running inside Tauri (browser dev mode)
  }
  const auto = () => useSettings.getState().autoUpdateCheck && void checkForUpdate(false);
  setTimeout(auto, 5_000);
  setInterval(auto, 6 * 60 * 60 * 1000);
}

/** `manual`: the user asked, so "up to date" and errors are shown too. */
export async function checkForUpdate(manual = true) {
  const s = useUpdate.getState();
  if (s.status === "checking" || s.status === "downloading") return;
  useUpdate.setState({ status: "checking", error: null, dismissed: false });
  try {
    pending = await check();
    if (!pending) {
      useUpdate.setState({ status: manual ? "uptodate" : "idle", version: null });
      return;
    }
    const skipped = useSettings.getState().skippedVersion;
    useUpdate.setState({
      status: "available",
      version: pending.version,
      notes: pending.body ?? "",
      dismissed: !manual && skipped === pending.version,
    });
  } catch (e) {
    useUpdate.setState({ status: manual ? "error" : "idle", error: String(e) });
  }
}

/** AppImage only: download, verify the signature, swap the file and restart. */
export async function installUpdate() {
  if (!pending) return;
  let total = 0;
  let received = 0;
  useUpdate.setState({ status: "downloading", progress: 0 });
  try {
    await pending.downloadAndInstall((e) => {
      if (e.event === "Started") total = e.data.contentLength ?? 0;
      else if (e.event === "Progress") {
        received += e.data.chunkLength;
        if (total) useUpdate.setState({ progress: received / total });
      }
    });
    useUpdate.setState({ status: "ready", progress: 1 });
    await relaunch();
  } catch (e) {
    useUpdate.setState({ status: "error", error: String(e) });
  }
}

export function skipVersion() {
  const v = useUpdate.getState().version;
  if (v) useSettings.getState().set({ skippedVersion: v });
  useUpdate.setState({ dismissed: true });
}

export const releaseUrl = (version: string) => `${RELEASES_URL}/tag/v${version}`;
export const debUrl = (version: string) => `${RELEASES_URL}/download/v${version}/T-rax_${version}_amd64.deb`;
