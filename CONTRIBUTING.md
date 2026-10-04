# Contributing to Adaptive Wiggle Cursor

First off, thank you for considering contributing to **Adaptive Wiggle Cursor**! 🎉 

Whether you are reporting a bug, proposing a new feature, improving documentation, or submitting a pull request, your contributions help make this extension better for everyone.

---

## 📋 Table of Contents

- [Code of Conduct](#-code-of-conduct)
- [How Can I Contribute?](#-how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Pull Requests](#pull-requests)
- [Local Development Setup](#-local-development-setup)
  - [Prerequisites](#prerequisites)
  - [Installation & Testing](#installation--testing)
  - [Viewing Live Logs](#viewing-live-logs)
- [Coding Standards & Guidelines](#-coding-standards--guidelines)

---

## 📜 Code of Conduct

This project and everyone participating in it is governed by the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to **aditya.krishnan005@gmail.com**.

---

## 💡 How Can I Contribute?

### Reporting Bugs

Before creating a bug report, please check the [existing Issues](https://github.com/adityakrishnan005-a11y/adaptive-wiggle-cursor/issues) to avoid duplicates.

When filing a bug, please use the **Bug Report Template** and provide:
1. **GNOME Shell Version** (`gnome-shell --version`)
2. **Session Type** (Wayland or X11 — run `echo $XDG_SESSION_TYPE`)
3. **Active Cursor Theme** (`gsettings get org.gnome.desktop.interface cursor-theme`)
4. **Steps to Reproduce** and expected vs actual behavior.
5. **Relevant Logs** from `journalctl` (see [Viewing Live Logs](#viewing-live-logs)).

### Suggesting Enhancements

Feature requests and performance ideas are warmly welcomed! Please submit an issue using the **Feature Request Template** outlining:
- The problem your idea solves or the improvement it introduces.
- Your proposed solution or desired behavior.
- Any relevant references (e.g., KDE/KWin behaviors, GNOME design guidelines).

### Pull Requests

1. **Fork the Repository** and create your branch from `main`:
   ```bash
   git checkout -b feature/my-new-feature
   ```
2. **Implement Your Changes**:
   - Keep changes focused and well-scoped.
   - Follow the existing coding style and ESM conventions.
   - Verify syntax with `node --check extension.js prefs.js`.
3. **Test Thoroughly**:
   - Test both Wayland and X11 sessions if possible.
   - Test with different cursor themes (e.g., Adwaita, Bibata, DMZ-White, custom themes).
   - Test preferences changes in real time.
4. **Commit Your Changes**:
   - Write clear, concise commit messages (e.g., `feat: ...`, `fix: ...`, `docs: ...`).
5. **Push and Open a PR**:
   - Push to your fork and submit a Pull Request to `main`.
   - Describe what changed and include reproduction/testing steps.

---

## 🛠️ Local Development Setup

### Prerequisites

- A Linux distribution running **GNOME Shell 45+** (tested on GNOME 45–50).
- `git`, `glib2` (for `glib-compile-schemas`), and standard GNOME development utilities.

### Installation & Testing

1. Clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/adaptive-wiggle-cursor.git
   cd adaptive-wiggle-cursor
   ```

2. Install the extension to your local GNOME Shell directory:
   ```bash
   ./install.sh
   ```

3. Reload GNOME Shell to test changes:
   - **Wayland**: Log out and log back in (or run a nested shell: `dbus-run-session gnome-shell --nested --wayland`).
   - **X11**: Press <kbd>Alt</kbd> + <kbd>F2</kbd>, type `r`, and press <kbd>Enter</kbd>.

4. Open extension preferences:
   ```bash
   gnome-extensions prefs adaptive-wiggle-cursor@aditya
   ```

### Viewing Live Logs

To monitor GNOME Shell extension logs and debug messages in real time:

```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

Or filter specifically for extension logs:
```bash
journalctl -b --no-pager | grep -i "adaptive-wiggle\|WiggleCursor"
```

---

## 📐 Coding Standards & Guidelines

- **Native ESM**: Use standard ECMAScript module syntax (`import ... from 'gi://...'` and `import ... from 'resource:///...'`).
- **GJS Conventions**:
  - GObject classes should use `GObject.registerClass()`.
  - Clean up all signal handlers and timeouts in `disable()`.
  - Avoid blocking synchronous file operations in continuous motion callbacks.
- **Hotspot Accuracy**: Always ensure cursor actor pivot points remain tied to the Xcursor hotspot coordinates $(x_{\text{hot}} / \text{width}, y_{\text{hot}} / \text{height})$.
- **Zero Idle Overhead**: All animation timers and motion loops must stop completely when the cursor is idle.

---

Thank you for contributing to Adaptive Wiggle Cursor! 🚀
