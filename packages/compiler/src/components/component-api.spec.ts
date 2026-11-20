import { describe, expect, it, vi } from 'vitest';
import { Component, Directive, EventEmitter, getComponentMetadata, getDirectiveMetadata, getPipeMetadata, HostBinding, HostListener, Input, Output, Pipe } from './component-api.js';

@Component({ selector: 'GefButton', template: '<button>{{ label }}</button>', styles: ['button { color: white; }'] })
class ButtonComponent {
  @Input() label = 'OK';
  @Input('isDisabled') disabled = false;
  @Output() readonly clicked = new EventEmitter<void>();
}
describe('component declaration API', () => {
  it('collects decorator metadata for template validation', () => {
    expect(getComponentMetadata(ButtonComponent)).toEqual({
      selector: 'GefButton', template: '<button>{{ label }}</button>',
      styles: ['button { color: white; }'], inputs: ['label', 'isDisabled'], outputs: ['clicked'],
    });
  });
  it('returns no metadata for an undecorated class', () => { expect(getComponentMetadata(class Plain {})).toBeUndefined(); });
  it('rejects empty selectors and templates', () => {
    expect(() => Component({ selector: '', template: 'x' })(class Invalid {})).toThrow(/selector/);
    expect(() => Component({ selector: 'GefEmpty', template: ' ' })(class Invalid {})).toThrow(/template/);
  });
  it('rejects duplicate public input names', () => {
    class Duplicate { @Input('value') first = ''; @Input('value') second = ''; }
    expect(() => Component({ selector: 'GefDuplicate', template: 'x' })(Duplicate)).toThrow(/duplicate input/);
  });
  it('emits values and supports idempotent unsubscribe', () => {
    const emitter = new EventEmitter<number>(); const listener = vi.fn();
    const subscription = emitter.subscribe(listener);
    emitter.emit(3); subscription.unsubscribe(); subscription.unsubscribe(); emitter.emit(4);
    expect(listener).toHaveBeenCalledOnce(); expect(listener).toHaveBeenCalledWith(3);
  });
  it('clears all output listeners', () => {
    const emitter = new EventEmitter<string>(); const listener = vi.fn();
    emitter.subscribe(listener); emitter.clear(); emitter.emit('ignored');
    expect(listener).not.toHaveBeenCalled();
  });
});

@Directive({ selector: '[gefTooltip]' })
class TooltipDirective {
  @Input() text = '';
  @HostBinding('accessible-name') accessibleName = '';
  @HostListener('button-press', ['$event']) onPress(_event: unknown): void {}
}
@Pipe({ name: 'uppercase' })
class UppercasePipe { transform(value: unknown): string { return String(value).toUpperCase(); } }

describe('directive and pipe declarations', () => {
  it('collects directive inputs and host bindings/listeners', () => {
    expect(getDirectiveMetadata(TooltipDirective)).toEqual({
      selector: '[gefTooltip]', inputs: ['text'], outputs: [],
      hostBindings: [{ member: 'accessibleName', property: 'accessible-name' }],
      hostListeners: [{ member: 'onPress', event: 'button-press', args: ['$event'] }],
    });
  });
  it('registers pipes as pure by default', () => {
    expect(getPipeMetadata(UppercasePipe)).toEqual({ name: 'uppercase', pure: true });
    expect(new UppercasePipe().transform('gef')).toBe('GEF');
  });
  it('supports explicitly impure pipes', () => {
    @Pipe({ name: 'clock', pure: false })
    class ClockPipe { transform(value: unknown): unknown { return value; } }
    expect(getPipeMetadata(ClockPipe)?.pure).toBe(false);
  });
  it('rejects invalid pipe names', () => {
    expect(() => Pipe({ name: 'not valid' })(class Invalid {})).toThrow(/pipe name/);
  });
});
