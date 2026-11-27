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

  it('emits GtkGrid children with validated cell positions and spans', () => {
    const ir = compileGtplToUiIr('<GtkGrid><GtkLabel label="Name" row="0" column="0" /><GtkEntry text="Ada" row="0" column="1" columnSpan="2" /><GtkButton label="Save" row="1" column="0" rowSpan="2" /></GtkGrid>');
    const result = emitGtkC(ir.nodes);
    expect(result.success).toBe(true);
    expect(result.source).toContain('GtkWidget *widget_0 = gtk_grid_new();');
    expect(result.source).toContain('gtk_grid_attach(GTK_GRID(widget_0), widget_1, 0, 0, 1, 1);');
    expect(result.source).toContain('gtk_grid_attach(GTK_GRID(widget_0), widget_2, 1, 0, 2, 1);');
    expect(result.source).toContain('gtk_grid_attach(GTK_GRID(widget_0), widget_3, 0, 1, 1, 2);');
  });

  it('rejects invalid GtkGrid child coordinates and spans', () => {
    const ir = compileGtplToUiIr('<GtkGrid><GtkLabel label="Bad" row="-1" columnSpan="0" /></GtkGrid>');
    const result = emitGtkC(ir.nodes);
    expect(result.success).toBe(false);
    expect(result.diagnostics).toContain('GtkGrid child row must be an integer greater than or equal to 0; received "-1".');
    expect(result.diagnostics).toContain('GtkGrid child columnSpan must be an integer greater than or equal to 1; received "0".');
  });

  it('emits common static GTK widget properties', () => {
    const ir = compileGtplToUiIr('<GtkBox marginTop="12" halign="center" visible="false"><GtkLabel label="Hello" marginStart="4" valign="end" /></GtkBox>');
    const result = emitGtkC(ir.nodes);
    expect(result.success).toBe(true);
    expect(result.source).toContain('gtk_widget_set_margin_top(widget_0, 12);');
    expect(result.source).toContain('gtk_widget_set_halign(widget_0, GTK_ALIGN_CENTER);');
    expect(result.source).toContain('gtk_widget_set_visible(widget_0, false);');
    expect(result.source).toContain('gtk_widget_set_margin_start(widget_1, 4);');
    expect(result.source).toContain('gtk_widget_set_valign(widget_1, GTK_ALIGN_END);');
  });

  it('emits static GTK entry and check button widgets', () => {
    const ir = compileGtplToUiIr('<GtkBox><GtkEntry text="Ada" placeholderText="Name" editable="false" visibility="false" /><GtkCheckButton label="Enabled" active="true" /></GtkBox>');
    const result = emitGtkC(ir.nodes);
    expect(result.success).toBe(true);
    expect(result.source).toContain('gtk_entry_new()');
    expect(result.source).toContain('gtk_editable_set_text(GTK_EDITABLE(widget_1), "Ada");');
    expect(result.source).toContain('gtk_entry_set_placeholder_text(GTK_ENTRY(widget_1), "Name");');
    expect(result.source).toContain('gtk_editable_set_editable(GTK_EDITABLE(widget_1), false);');
    expect(result.source).toContain('gtk_entry_set_visibility(GTK_ENTRY(widget_1), false);');
    expect(result.source).toContain('gtk_check_button_new_with_label("Enabled")');
    expect(result.source).toContain('gtk_check_button_set_active(GTK_CHECK_BUTTON(widget_2), true);');
  });

  it('connects GtkButton clicked events to explicitly mapped native callbacks', () => {
    const ir = compileGtplToUiIr('<GtkButton label="Save" (clicked)="this.save()" />');
    const result = emitGtkC(ir.nodes, { callbacks: { save: 'gef_on_save' } });
    expect(result.success).toBe(true);
    expect(result.source).toContain('extern void gef_on_save(GtkButton *button, gpointer user_data);');
    expect(result.source).toContain('g_signal_connect(widget_0, "clicked", G_CALLBACK(gef_on_save), NULL);');
  });

  it('rejects unsupported event handlers and invalid callback symbols', () => {
    const unsupported = emitGtkC(compileGtplToUiIr('<GtkButton (clicked)="this.save(value)" />').nodes, { callbacks: { save: 'gef_on_save' } });
    expect(unsupported.success).toBe(false);
    expect(unsupported.diagnostics[0]).toContain('requires a zero-argument this.method() handler');
    const invalid = emitGtkC(compileGtplToUiIr('<GtkButton (clicked)="this.save()" />').nodes, { callbacks: { save: 'gef-on-save' } });
    expect(invalid.success).toBe(false);
    expect(invalid.diagnostics[0]).toContain('requires a valid native callback symbol');
  });

  it('rejects invalid entry and check button boolean values', () => {
    const ir = compileGtplToUiIr('<GtkBox><GtkEntry editable="yes" /><GtkCheckButton active="1" /></GtkBox>');
    const result = emitGtkC(ir.nodes);
    expect(result.success).toBe(false);
    expect(result.diagnostics).toContain('GtkEntry editable must be "true" or "false"; received "yes".');
    expect(result.diagnostics).toContain('GtkCheckButton active must be "true" or "false"; received "1".');
  });

  it('rejects invalid common property values', () => {
    const ir = compileGtplToUiIr('<GtkLabel marginTop="-2" halign="middle" visible="yes" />');
    const result = emitGtkC(ir.nodes);
    expect(result.success).toBe(false);
    expect(result.source).toBe('');
    expect(result.diagnostics).toContain('GtkLabel marginTop must be a non-negative integer; received "-2".');
    expect(result.diagnostics).toContain('GtkLabel halign must be one of: fill, start, end, center, baseline; received "middle".');
    expect(result.diagnostics).toContain('GtkLabel visible must be "true" or "false"; received "yes".');
  });

  it('rejects bindings and unsupported control flow instead of emitting incomplete C', () => {
    const ir = compileGtplToUiIr('<GtkLabel [label]="title" />');
    const result = emitGtkC(ir.nodes);
    expect(result.success).toBe(false);
    expect(result.source).toBe('');
    expect(result.diagnostics).toContain('Property binding "label" is not a compile-time constant supported by the static C backend.');
  });


  it('emits literal property bindings as static GTK values', () => {
    const ir = compileGtplToUiIr('<GtkBox [spacing]="4"><GtkLabel [label]="\'Hello\'" [visible]="false" /></GtkBox>');
    const result = emitGtkC(ir.nodes);
    expect(result.success).toBe(true);
    expect(result.source).toContain('gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 4)');
    expect(result.source).toContain('gtk_label_new("Hello")');
    expect(result.source).toContain('gtk_widget_set_visible(widget_1, false);');
  });

  it('evaluates constant unary, binary and conditional property expressions', () => {
    const ir = compileGtplToUiIr(`<GtkBox [spacing]="2 + 3 * 4"><GtkLabel [label]="'GEF' + ' GTK'" [visible]="!(1 > 2)" /></GtkBox>`);
    const result = emitGtkC(ir.nodes);
    expect(result.success).toBe(true);
    expect(result.source).toContain('gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 14)');
    expect(result.source).toContain('gtk_label_new("GEF GTK")');
    expect(result.source).toContain('gtk_widget_set_visible(widget_1, true);');
  });

  it('rejects non-finite numeric constant expressions', () => {
    const ir = compileGtplToUiIr('<GtkBox [spacing]="10 ** 10000" />');
    const result = emitGtkC(ir.nodes);
    expect(result.success).toBe(false);
    expect(result.diagnostics).toContain('Property binding "spacing" is not a compile-time constant supported by the static C backend.');
  });

  it('rejects runtime and unsupported property expressions', () => {
    const ir = compileGtplToUiIr(`<GtkBox><GtkLabel [label]="title" /><GtkEntry [text]="null" /><GtkLabel [label]="1 + title" /></GtkBox>`);
    const result = emitGtkC(ir.nodes);
    expect(result.success).toBe(false);
    expect(result.diagnostics).toContain('Property binding "label" is not a compile-time constant supported by the static C backend.');
    expect(result.diagnostics).toContain('Property binding "text" is not a compile-time constant supported by the static C backend.');
  });
  it('rejects non-literal and null property bindings', () => {
    const ir = compileGtplToUiIr('<GtkBox><GtkLabel [label]="title" /><GtkEntry [text]="null" /></GtkBox>');
    const result = emitGtkC(ir.nodes);
    expect(result.success).toBe(false);
    expect(result.diagnostics).toContain('Property binding "label" is not a compile-time constant supported by the static C backend.');
    expect(result.diagnostics).toContain('Property binding "text" is not a compile-time constant supported by the static C backend.');
  });

  it('rejects unsupported widget names', () => {
    const ir = compileGtplToUiIr('<GtkTextView />');
    const result = emitGtkC(ir.nodes);
    expect(result.success).toBe(false);
    expect(result.diagnostics[0]).toContain('Unsupported GTK element "GtkTextView"');
  });
});
