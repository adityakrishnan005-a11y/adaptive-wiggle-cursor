# Adaptive Wiggle Cursor

An adaptive, high-performance GNOME Shell extension that enlarges your mouse cursor when you shake/wiggle it. Built from scratch using KDE Plasma's proven shake-to-find physics algorithm and high-fidelity native Xcursor theme rendering.

---

## ✨ Features

- 🎯 **KDE Plasma Shake Physics**: Accurately detects deliberate, vigorous mouse wiggling using a sliding time-window path-to-diagonal ratio algorithm. Rejects casual mouse navigation and broad sweeps.
- 📈 **Adaptive Stepped Growth**: Shaking your mouse enlarges the cursor to an initial prominent size ($2.5\times$). Continuing to shake dynamically steps the size up in increments up to **50%–100% of your screen height**.
- 🌊 **Smooth Deflation**: Automatically and smoothly scales back down to normal size over $180\text{ms}$ using `InOutCubic` easing after $1.8\text{s}$ of inactivity.
- 🎨 **Exact Theme Preservation**: Parses your system's active Xcursor binary theme (e.g. *Bibata-Modern*, *Adwaita*, *Yaru*, etc.) and renders the high-resolution RGBA pixel data via `St.ImageContent` and Cogl. Your cursor colors, shape, and transparency are preserved identically.
- 🎯 **Pixel-Perfect Hotspot Alignment**: Uses sub-pixel Graphene pivot tracking so the pointer tip remains strictly locked to your hardware mouse coordinates at any magnification level.
- 👻 **Hardware Pointer Hiding**: Automatically inhibits the underlying system cursor while magnified so you never see a smaller cursor poking out underneath.
- ⚙️ **Libadwaita Preferences**: Easily adjust trigger sensitivity and maximum screen ratio via the GNOME Extensions settings dialog.
- ⚡ **Zero Idle Overhead**: Pure event-driven implementation connected to `Meta.CursorTracker`. Consumes 0% CPU when the cursor is idle.

---

## 🖥️ Compatibility

- **GNOME Shell Versions**: `45`, `46`, `47`, `48`, `49`, `50`
- **Display Server**: Wayland & X11
- **Architecture**: ESM (ECMAScript Modules) native

---

## 📥 Installation

### Manual Installation (From Source)

1. Clone the repository:
   ```bash
   git clone https://github.com/adityakrishnan005-a11y/adaptive-wiggle-cursor.git
   cd adaptive-wiggle-cursor
   ```

2. Run the installer script:
   ```bash
   ./install.sh
   ```

3. Restart your GNOME Shell session:
   - **Wayland**: Log out and log back in.
   - **X11**: Press <kbd>Alt</kbd> + <kbd>F2</kbd>, type `r`, and press <kbd>Enter</kbd>.

4. Enable the extension (if not already enabled):
   ```bash
   gnome-extensions enable adaptive-wiggle-cursor@aditya
   ```

---

## ⚙️ Configuration

Open the preferences window to customize the behavior:

```bash
gnome-extensions prefs adaptive-wiggle-cursor@aditya
```

Or open the **Extensions** app in GNOME and click **Settings** next to **Adaptive Wiggle Cursor**.

### Available Settings

| Setting | Description | Default | Range |
| :--- | :--- | :---: | :---: |
| **Maximum Cursor Size** | Maximum cursor height as a percentage of screen height | `50%` | `50% – 100%` |
| **Trigger Sensitivity** | Vigor required to trigger initial shake (higher = easier) | `1.0` | `0.2 – 2.0` |

---

## 🔬 How It Works

### 1. Motion Tracking & Shake Detection
The extension monitors mouse pointer coordinates through `Meta.CursorTracker`. It maintains an $800\text{ms}$ history buffer of movement vectors:
- Filter out linear movements (`sameSign` direction test).
- Tracks directional reversal strokes.
- Evaluates the ratio:
  $$\text{ShakeFactor} = \frac{\text{Total Path Distance}}{\text{Bounding Box Diagonal}}$$
- Triggers initial enlargement when reversal count $\ge 4$, path distance $\ge 260\text{px}$, and $\text{ShakeFactor} > \text{Threshold}$.

### 2. Rendering Pipeline
- Locates and parses the active cursor theme binary from `~/.local/share/icons/`, `~/.icons/`, or `/usr/share/icons/`.
- Extracts the highest available resolution image and its exact hotspot $(x_{\text{hot}}, y_{\text{hot}})$.
- Constructs an `St.ImageContent` actor attached to GNOME Shell's `Main.uiGroup`.
- Temporarily inhibits system pointer visibility via Mutter's cursor tracker while active.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
