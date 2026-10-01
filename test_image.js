import Cogl from 'gi://Cogl';
import Clutter from 'gi://Clutter';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

console.log('Testing GJS Clutter.Image API:');
console.log('Clutter.Image:', Object.getOwnPropertyNames(Clutter.Image.prototype));
