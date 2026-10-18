#!/usr/bin/env bash
# Installs T-rax for the current user (no sudo): binary, icons and app-menu entry.
# Usage: scripts/install-linux.sh [path/to/t-rax binary or T-rax_*.AppImage]
#        scripts/install-linux.sh --uninstall
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="$HOME/.local/bin"
APP_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons/hicolor"

if [[ "${1:-}" == "--uninstall" ]]; then
  rm -f "$BIN_DIR/t-rax" "$APP_DIR/t-rax.desktop"
  for s in 32x32 64x64 128x128 256x256; do rm -f "$ICON_DIR/$s/apps/t-rax.png"; done
  update-desktop-database "$APP_DIR" 2>/dev/null || true
  echo "T-rax removed."
  exit 0
fi

SRC="${1:-$ROOT/src-tauri/target/release/t-rax}"
if [[ ! -f "$SRC" ]]; then
  echo "Binary not found: $SRC (build it with: npm run tauri build)" >&2
  exit 1
fi

install -Dm755 "$SRC" "$BIN_DIR/t-rax"

ICONS="$ROOT/src-tauri/icons"
install -Dm644 "$ICONS/32x32.png" "$ICON_DIR/32x32/apps/t-rax.png"
install -Dm644 "$ICONS/64x64.png" "$ICON_DIR/64x64/apps/t-rax.png"
install -Dm644 "$ICONS/128x128.png" "$ICON_DIR/128x128/apps/t-rax.png"
install -Dm644 "$ICONS/128x128@2x.png" "$ICON_DIR/256x256/apps/t-rax.png"

# The desktop file name matches the Wayland app id (the binary name), so the
# running window gets this icon in the dock and the Alt+Tab switcher.
mkdir -p "$APP_DIR"
cat > "$APP_DIR/t-rax.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=T-rax
GenericName=Terminal & AI Workspace
Comment=Terminal-first, AI-native dev workspace
Exec=$BIN_DIR/t-rax %f
Icon=t-rax
Terminal=false
Categories=Development;
Keywords=terminal;editor;git;ai;
StartupWMClass=t-rax
StartupNotify=true
DESKTOP

update-desktop-database "$APP_DIR" 2>/dev/null || true
gtk-update-icon-cache -q -t "$ICON_DIR" 2>/dev/null || true
echo "T-rax installed. Open it from the app menu, or run: t-rax [folder]"
