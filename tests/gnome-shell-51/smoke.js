import Clutter from 'gi://Clutter';
import St from 'gi://St';

Clutter.init(null);

const box = new St.BoxLayout({ vertical: true });
const label = new St.Label({ text: 'GEF GNOME Shell 51 smoke test' });
let destroyed = false;

box.add_child(label);
label.connect('destroy', () => { destroyed = true; });
if (label.get_text() !== 'GEF GNOME Shell 51 smoke test') {
  throw new Error('St.Label did not preserve its text property.');
}
box.destroy();
if (!destroyed) throw new Error('St actor destroy signal was not emitted.');

print('GNOME Shell 51 St actor smoke test passed.');
