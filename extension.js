/**
 * Adaptive Wiggle Cursor — GNOME Shell Extension (built from scratch)
 *
 * Replicates KDE Plasma's ShakeCursor algorithm:
 *   1. Tracks pointer motion within a sliding time window (1000ms).
 *   2. Detects direction reversals; when the path-distance/bounding-box-diagonal
 *      ratio exceeds a sensitivity threshold → shake detected.
 *   3. First shake → cursor enlarges to base magnification (3×).
 *   4. Each additional shake while already enlarged → +1× more (overMagnification).
 *   5. 2 seconds after last shake → smoothly animates back to 1.0× (deflate).
 *
 * Rendering uses St.ImageContent + Xcursor binary parsing so the user's exact
 * cursor theme (Bibata, Adwaita, etc.) is preserved at any scale with exact tip hotspot.
 */

import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import Meta from 'gi://Meta';
import St from 'gi://St';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

// ─── Xcursor Binary Parser ──────────────────────────────────────────────────

/**
 * Parses an Xcursor file and returns the highest-resolution cursor image
 * along with its exact hotspot coordinates and RGBA pixel data.
 */
function parseXcursorFile(filePath) {
    try {
        const [ok, fileBytes] = GLib.file_get_contents(filePath);
        if (!ok || !fileBytes || fileBytes.length < 36) return null;

        const dv = new DataView(fileBytes.buffer, fileBytes.byteOffset, fileBytes.byteLength);

        // Validate Xcur magic
        if (dv.getUint32(0, true) !== 0x72756358) return null;

        const ntoc = dv.getUint32(12, true);
        let best = null;

        for (let i = 0; i < ntoc; i++) {
            const off = 16 + i * 12;
            if (off + 12 > fileBytes.length) break;

            const ctype = dv.getUint32(off, true);
            const subtype = dv.getUint32(off + 4, true); // size
            const pos = dv.getUint32(off + 8, true);

            if (ctype === 0xfffd0002 && pos + 36 <= fileBytes.length) {
                const w = dv.getUint32(pos + 16, true);
                const h = dv.getUint32(pos + 20, true);
                const xhot = dv.getUint32(pos + 24, true);
                const yhot = dv.getUint32(pos + 28, true);

                if (!best || subtype > best.size) {
                    best = { size: subtype, width: w, height: h, xhot, yhot, pixelOffset: pos + 36 };
                }
            }
        }

        if (!best) return null;
        const count = best.width * best.height * 4;
        if (best.pixelOffset + count > fileBytes.length) return null;

        // Xcursor stores premultiplied ARGB in native byte order (little-endian: BGRA)
        const raw = new Uint8Array(fileBytes.buffer, fileBytes.byteOffset + best.pixelOffset, count);

        // Convert BGRA to RGBA for standard Cogl PixelFormat
        const rgba = new Uint8Array(count);
        for (let i = 0; i < count; i += 4) {
            rgba[i] = raw[i + 2];     // R
            rgba[i + 1] = raw[i + 1]; // G
            rgba[i + 2] = raw[i];     // B
            rgba[i + 3] = raw[i + 3]; // A
        }

        return {
            width: best.width,
            height: best.height,
            xhot: best.xhot,
            yhot: best.yhot,
            rgbaPixels: rgba,
        };
    } catch (e) {
        console.warn('[WiggleCursor] Failed to parse Xcursor:', e);
        return null;
    }
}

/**
 * Locates the left_ptr cursor file for a given theme name.
 */
function findCursorFile(themeName) {
    const dirs = [
        GLib.build_filenamev([GLib.get_home_dir(), '.local', 'share', 'icons', themeName, 'cursors']),
        GLib.build_filenamev([GLib.get_home_dir(), '.icons', themeName, 'cursors']),
        GLib.build_filenamev(['/usr', 'share', 'icons', themeName, 'cursors']),
        GLib.build_filenamev(['/usr', 'share', 'icons', 'default', 'cursors']),
        GLib.build_filenamev(['/usr', 'share', 'icons', 'Adwaita', 'cursors']),
    ];
    const names = ['left_ptr', 'default', 'arrow'];

    for (const dir of dirs) {
        if (!GLib.file_test(dir, GLib.FileTest.IS_DIR)) continue;
        for (const name of names) {
            const p = GLib.build_filenamev([dir, name]);
            if (GLib.file_test(p, GLib.FileTest.EXISTS)) return p;
        }
    }
    return null;
}

// ─── KDE-style Shake Detector ────────────────────────────────────────────────

class ShakeDetector {
    constructor() {
        this._interval = 800; // ms — time window for shake detection
        this._sensitivity = 1.0; // multiplier from settings
        this._history = []; // {x, y, t} entries
    }

    set interval(v) { this._interval = v; }
    set sensitivity(v) { this._sensitivity = v; }

    reset() {
        this._history = [];
    }

    /**
     * Feed a pointer position; returns true if a shake was detected.
     * @param {number} x
     * @param {number} y
     * @param {number} timeMs
     * @param {boolean} isAlreadyActive - whether the cursor is currently magnified
     */
    update(x, y, timeMs, isAlreadyActive = false) {
        // Prune old entries outside the time window
        const cutoff = timeMs - this._interval;
        let pruneIdx = 0;
        while (pruneIdx < this._history.length && this._history[pruneIdx].t < cutoff) {
            pruneIdx++;
        }
        if (pruneIdx > 0) this._history.splice(0, pruneIdx);

        // Movement tolerance: <= 2px counts as same direction
        const sameSign = (a, b) => (a >= -2.0 && b >= -2.0) || (a <= 2.0 && b <= 2.0);

        if (this._history.length >= 2) {
            const last = this._history[this._history.length - 1];
            const prev = this._history[this._history.length - 2];
            if (sameSign(last.x - prev.x, x - last.x) &&
                sameSign(last.y - prev.y, y - last.y)) {
                last.x = x;
                last.y = y;
                last.t = timeMs;
                return false;
            }
        }

        // Direction changed → push a new entry (reversal stroke)
        this._history.push({ x, y, t: timeMs });

        // Compute total path distance and bounding box
        let left = this._history[0].x, right = left;
        let top = this._history[0].y, bottom = top;
        let distance = 0;

        for (let i = 1; i < this._history.length; i++) {
            const dx = this._history[i].x - this._history[i - 1].x;
            const dy = this._history[i].y - this._history[i - 1].y;
            distance += Math.hypot(dx, dy);

            left = Math.min(left, this._history[i].x);
            top = Math.min(top, this._history[i].y);
            right = Math.max(right, this._history[i].x);
            bottom = Math.max(bottom, this._history[i].y);
        }

        const diagonal = Math.hypot(right - left, bottom - top);

        if (isAlreadyActive) {
            // While already enlarged: lighter threshold to sustain and continue growing
            if (diagonal < 30.0 || distance < 120.0 || this._history.length < 3) return false;
            const threshold = Math.max(2.2, 3.8 / this._sensitivity);
            if ((distance / diagonal) > threshold) {
                this._history = [];
                return true;
            }
        } else {
            // First-time trigger: requires genuine deliberate VIGOROUS wiggling
            // 1. Must have at least 4 direction reversals in the window
            if (this._history.length < 4) return false;
            // 2. Must have moved at least 260px total path in the window (vigorous speed)
            if (distance < 260.0) return false;
            // 3. Diagonal must be bounded (between 50px and 380px) - wiggling in place, not huge sweeps
            if (diagonal < 50.0 || diagonal > 380.0) return false;

            // 4. Required ratio scaled by sensitivity (default sensitivity 1.0 -> required ratio 5.2)
            const requiredRatio = Math.max(3.5, 5.2 / this._sensitivity);
            const shakeFactor = distance / diagonal;

            if (shakeFactor > requiredRatio) {
                this._history = [];
                return true;
            }
        }

        return false;
    }
}

// ─── Extension ───────────────────────────────────────────────────────────────

export default class AdaptiveWiggleCursorExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._ifaceSettings = new Gio.Settings({ schema: 'org.gnome.desktop.interface' });

        // ── Config ──
        this._maxScreenRatio = this._settings.get_double('max-screen-ratio');
        this._triggerSensitivity = this._settings.get_double('trigger-sensitivity');

        this._settingsIds = [
            this._settings.connect('changed::max-screen-ratio', () => {
                this._maxScreenRatio = this._settings.get_double('max-screen-ratio');
            }),
            this._settings.connect('changed::trigger-sensitivity', () => {
                this._triggerSensitivity = this._settings.get_double('trigger-sensitivity');
                this._shakeDetector.sensitivity = this._triggerSensitivity;
            }),
        ];

        // ── Cursor theme loading ──
        this._cursorInfo = null; // parsed Xcursor data
        this._loadCursorTheme();

        this._themeSignalId = this._ifaceSettings.connect('changed::cursor-theme', () => {
            this._loadCursorTheme();
            this._rebuildActor();
        });

        // ── Shake detector ──
        this._shakeDetector = new ShakeDetector();
        this._shakeDetector.interval = 800;
        this._shakeDetector.sensitivity = this._triggerSensitivity;

        // ── KDE-style magnification state ──
        this._baseMag = 2.5;       // Initial magnification on first shake
        this._overMag = 0.8;       // Additional magnification per subsequent shake stroke
        this._targetMag = 1.0;     // Target we're animating toward
        this._currentMag = 1.0;    // Current rendered magnification

        // ── Animation state ──
        this._animStartMag = 1.0;
        this._animEndMag = 1.0;
        this._animStartTime = 0;
        this._animDuration = 180;  // ms (KDE InOutCubic transition)
        this._animTimerId = null;

        // ── Deflate timer: 1.8 seconds after last shake, shrink back to 1× ──
        this._deflateTimerId = null;

        // ── Create overlay actor ──
        this._buildActor();

        // ── Connect to pointer tracker ──
        this._cursorTracker = global.backend?.get_cursor_tracker?.() ??
            Meta.CursorTracker.get_for_display(global.display);
        this._posSignalId = this._cursorTracker.connect('position-invalidated', () => {
            this._onPointerMoved();
        });
    }

    // ── Cursor Theme Loading ──

    _loadCursorTheme() {
        const themeName = this._ifaceSettings.get_string('cursor-theme') || 'default';
        const file = findCursorFile(themeName);
        this._cursorInfo = file ? parseXcursorFile(file) : null;

        if (!this._cursorInfo) {
            console.warn('[WiggleCursor] Could not load cursor theme:', themeName);
        }
    }

    // ── Actor Construction ──

    _buildActor() {
        if (this._actor) {
            Main.uiGroup.remove_child(this._actor);
            this._actor.destroy();
        }

        this._actor = new Clutter.Actor({
            name: 'wiggle-cursor-overlay',
            reactive: false,
            visible: false,
            opacity: 0,
        });

        if (this._cursorInfo) {
            const ci = this._cursorInfo;
            this._actor.set_size(ci.width, ci.height);

            // Set pivot at hotspot so scaling radiates from the cursor tip
            this._actor.pivot_point = new Graphene.Point({
                x: ci.width > 0 ? ci.xhot / ci.width : 0,
                y: ci.height > 0 ? ci.yhot / ci.height : 0,
            });

            // Create St.ImageContent with the cursor pixels
            try {
                const imageContent = new St.ImageContent({
                    preferredWidth: ci.width,
                    preferredHeight: ci.height,
                });

                const bytes = new GLib.Bytes(ci.rgbaPixels);
                const coglArgs = [];
                const mutterBackend = global.stage?.context?.get_backend?.();
                const pixelFormat = Cogl.PixelFormat.RGBA_8888_PRE ?? Cogl.PixelFormat.RGBA_8888;

                if (imageContent.set_bytes) {
                    if (imageContent.set_bytes.length === 6 && mutterBackend?.get_cogl_context) {
                        coglArgs.push(mutterBackend.get_cogl_context());
                    }
                    imageContent.set_bytes(
                        ...coglArgs,
                        bytes,
                        pixelFormat,
                        ci.width,
                        ci.height,
                        ci.width * 4
                    );
                } else if (imageContent.set_data) {
                    if (imageContent.set_data.length === 6 && mutterBackend?.get_cogl_context) {
                        coglArgs.push(mutterBackend.get_cogl_context());
                    }
                    imageContent.set_data(
                        ...coglArgs,
                        ci.rgbaPixels,
                        pixelFormat,
                        ci.width,
                        ci.height,
                        ci.width * 4
                    );
                }

                this._actor.content = imageContent;
            } catch (e) {
                console.warn('[WiggleCursor] Failed to create image content:', e);
            }
        }

        Main.uiGroup.add_child(this._actor);
    }

    _rebuildActor() {
        const wasVisible = this._actor && this._actor.visible;
        this._buildActor();
        if (wasVisible && this._currentMag > 1.0) {
            this._applyMagnification(this._currentMag);
        }
    }

    // ── Pointer Motion ──

    _onPointerMoved() {
        const [px, py] = global.get_pointer();
        const now = GLib.get_monotonic_time() / 1000.0; // ms

        const isCurrentlyActive = this._currentMag > 1.05 || this._targetMag > 1.05;
        if (this._shakeDetector.update(px, py, now, isCurrentlyActive)) {
            this._inflate();
        }

        // Keep overlay following the pointer
        if (this._actor && this._actor.visible) {
            this._actor.set_position(px, py);
        }
    }

    // ── KDE-style Inflate / Deflate ──

    _inflate() {
        let newMag;
        if (this._targetMag <= 1.0) {
            // First shake — jump to base magnification
            newMag = this._baseMag;
        } else {
            // Already enlarged — add overMagnification continuously
            newMag = this._targetMag + this._overMag;
        }

        // Clamp to max screen ratio (e.g. 50% screen height)
        const monitor = Main.layoutManager.currentMonitor ?? Main.layoutManager.primaryMonitor;
        const screenH = monitor ? monitor.height : 1080;
        const baseCursorH = this._ifaceSettings.get_int('cursor-size') || 24;
        const maxMag = (screenH * this._maxScreenRatio) / baseCursorH;
        newMag = Math.min(newMag, maxMag);

        this._animateTo(newMag);

        // Reset the deflate timer (deflates back after 1.8 seconds of no shaking)
        if (this._deflateTimerId) {
            GLib.Source.remove(this._deflateTimerId);
        }
        this._deflateTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1800, () => {
            this._deflateTimerId = null;
            this._animateTo(1.0);
            return GLib.SOURCE_REMOVE;
        });
    }

    _animateTo(mag) {
        if (this._targetMag === mag) return;

        this._animStartMag = this._currentMag;
        this._animEndMag = mag;
        this._animStartTime = GLib.get_monotonic_time() / 1000.0;
        this._targetMag = mag;

        if (!this._animTimerId) {
            this._animTimerId = GLib.timeout_add(GLib.PRIORITY_HIGH, 16, () => this._onAnimFrame());
        }
    }

    _onAnimFrame() {
        const now = GLib.get_monotonic_time() / 1000.0;
        const elapsed = now - this._animStartTime;
        let t = Math.min(1.0, elapsed / this._animDuration);

        // InOutCubic easing (same as KDE)
        if (t < 0.5) {
            t = 4 * t * t * t;
        } else {
            t = 1 - Math.pow(-2 * t + 2, 3) / 2;
        }

        this._currentMag = this._animStartMag + (this._animEndMag - this._animStartMag) * t;
        this._applyMagnification(this._currentMag);

        if (elapsed >= this._animDuration) {
            this._currentMag = this._animEndMag;
            this._applyMagnification(this._currentMag);
            this._animTimerId = null;
            return GLib.SOURCE_REMOVE;
        }

        return GLib.SOURCE_CONTINUE;
    }

    _applyMagnification(mag) {
        if (!this._actor) return;

        const [px, py] = global.get_pointer();
        this._actor.set_position(px, py);

        if (mag > 1.01 && this._cursorInfo) {
            this._actor.show();
            const baseCursorH = this._ifaceSettings.get_int('cursor-size') || 24;
            const nativeH = this._cursorInfo.height || 24;
            const scale = (mag * baseCursorH) / nativeH;
            this._actor.set_scale(scale, scale);
            this._actor.opacity = Math.min(255, Math.round((mag - 1.0) * 200 + 55));
        } else {
            this._actor.set_scale(1, 1);
            this._actor.opacity = 0;
            this._actor.hide();
        }
    }

    // ── Cleanup ──

    disable() {
        if (this._animTimerId) {
            GLib.Source.remove(this._animTimerId);
            this._animTimerId = null;
        }
        if (this._deflateTimerId) {
            GLib.Source.remove(this._deflateTimerId);
            this._deflateTimerId = null;
        }
        if (this._posSignalId && this._cursorTracker) {
            this._cursorTracker.disconnect(this._posSignalId);
            this._posSignalId = null;
        }
        if (this._themeSignalId && this._ifaceSettings) {
            this._ifaceSettings.disconnect(this._themeSignalId);
            this._themeSignalId = null;
        }
        if (this._settingsIds && this._settings) {
            this._settingsIds.forEach(id => this._settings.disconnect(id));
            this._settingsIds = null;
        }
        if (this._actor) {
            Main.uiGroup.remove_child(this._actor);
            this._actor.destroy();
            this._actor = null;
        }

        this._cursorInfo = null;
        this._settings = null;
        this._ifaceSettings = null;
        this._cursorTracker = null;
        this._shakeDetector = null;
    }
}
