import { describe, expect, it } from 'vitest';
import { compileGtplToUiIr } from '../../ir/ui.js';
import { emitGtkC } from './emit.js';

describe('GTK4 C backend', () => {
  it('emits a static GTK application from supported UI IR', () => {
    const ir = compileGtplToUiIr('<GtkBox orientation="vertical" spacing="8"><GtkLabel label="Hello" /><GtkButton label="Save" /></GtkBox>');
    expect(ir.success).toBe(true);
    const result = emitGtkC(ir.nodes);
    expect(result.success).toBe(true);
    expect(result.source).toContain('gtk_application_window_new(app)');
    expect(result.source).toContain('gtk_box_new(GTK_ORIENTATION_VERTICAL, 8)');
    expect(result.source).toContain('gtk_label_new("Hello")');
    expect(result.source).toContain('gtk_button_new_with_label("Save")');
    expect(result.source).toContain('gtk_box_append(GTK_BOX(widget_0), widget_1)');
  });

  it('rejects bindings and unsupported control flow instead of emitting incomplete C', () => {
    const ir = compileGtplToUiIr('<GtkLabel [label]="title" />');
    const result = emitGtkC(ir.nodes);
    expect(result.success).toBe(false);
    expect(result.source).toBe('');
    expect(result.diagnostics).toContain('Dynamic property "label" is not supported by the static C backend.');
  });

  it('rejects unsupported widget names', () => {
    const ir = compileGtplToUiIr('<GtkEntry />');
    const result = emitGtkC(ir.nodes);
    expect(result.success).toBe(false);
    expect(result.diagnostics[0]).toContain('Unsupported GTK element "GtkEntry"');
  });
});
