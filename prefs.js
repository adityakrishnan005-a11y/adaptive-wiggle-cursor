/**
 * Preferences for Adaptive Wiggle Cursor
 */

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class AdaptiveWiggleCursorPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: _('Settings'),
            icon_name: 'input-mouse-symbolic',
        });
        window.add(page);

        const group = new Adw.PreferencesGroup({
            title: _('Shake Detection'),
            description: _('Configure how the cursor responds to shaking (based on KDE Plasma algorithm).'),
        });
        page.add(group);

        // Max Screen Ratio
        const maxRatioRow = new Adw.SpinRow({
            title: _('Maximum Cursor Size'),
            subtitle: _('Caps cursor growth as a percentage of screen height'),
            adjustment: new Gtk.Adjustment({
                lower: 15,
                upper: 75,
                step_increment: 5,
                page_increment: 10,
                value: Math.round(settings.get_double('max-screen-ratio') * 100),
            }),
        });
        maxRatioRow.connect('notify::value', () => {
            settings.set_double('max-screen-ratio', maxRatioRow.get_value() / 100.0);
        });
        group.add(maxRatioRow);

        // Trigger Sensitivity
        const sensitivityRow = new Adw.SpinRow({
            title: _('Trigger Sensitivity'),
            subtitle: _('Higher values make shake detection easier to trigger'),
            adjustment: new Gtk.Adjustment({
                lower: 0.5,
                upper: 2.0,
                step_increment: 0.1,
                page_increment: 0.5,
                value: settings.get_double('trigger-sensitivity'),
            }),
            digits: 1,
        });
        sensitivityRow.connect('notify::value', () => {
            settings.set_double('trigger-sensitivity', sensitivityRow.get_value());
        });
        group.add(sensitivityRow);
    }
}
