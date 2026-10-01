#!/usr/bin/env bash
set -e

UUID="adaptive-wiggle-cursor@aditya"
INSTALL_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Installing Adaptive Wiggle Cursor Extension ==="

# 1. Compile schema in source directory
echo "[1/4] Compiling GSettings schema..."
glib-compile-schemas "$SRC_DIR/schemas"

# 2. Create target extension directory
echo "[2/4] Preparing extension directory: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/schemas"

# 3. Copy extension files
echo "[3/4] Copying extension files..."
cp "$SRC_DIR/metadata.json" "$INSTALL_DIR/"
cp "$SRC_DIR/extension.js" "$INSTALL_DIR/"
cp "$SRC_DIR/prefs.js" "$INSTALL_DIR/"
cp "$SRC_DIR/stylesheet.css" "$INSTALL_DIR/"
cp "$SRC_DIR/schemas/"*.xml "$INSTALL_DIR/schemas/"
cp "$SRC_DIR/schemas/"*.compiled "$INSTALL_DIR/schemas/" 2>/dev/null || true

# Recompile schema in target directory to ensure gschemas.compiled exists
glib-compile-schemas "$INSTALL_DIR/schemas"

# 4. Enable extension
echo "[4/4] Enabling extension via gnome-extensions..."
if command -v gnome-extensions >/dev/null 2>&1; then
    gnome-extensions enable "$UUID" || true
    echo "Extension enabled! You can test it by wiggling/shaking your mouse back and forth."
    echo "Open settings with: gnome-extensions prefs $UUID"
else
    echo "Installed. Please enable '$UUID' in the Extensions app."
fi

echo "=== Installation Complete! ==="
