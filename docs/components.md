# Components, directives and pipes

GEF declarations are TypeScript decorators that produce immutable metadata.
The runtime stays reflection-free: pass the metadata into an explicit registry.

## Component

```ts
import { Component, Input, Output } from 'gnome-extension-framework/runtime';
import { getComponentMetadata } from 'gnome-extension-framework';
import { EventEmitter } from 'gnome-extension-framework/runtime';

@Component({
  selector: 'GefCounter',
  template: '<StButton (clicked)="increment()">{{ count }}</StButton>',
})
export class CounterComponent {
  @Input() count = 0;
  @Output() readonly changed = new EventEmitter<number>();

  increment(): void {
    this.changed.emit(this.count + 1);
  }
}
```

Compile the component template with `compileGtplComponent`, then register its
metadata with a generated render function:

```ts
const metadata = getComponentMetadata(CounterComponent)!;
const components = new ComponentRegistry<StActor>().registerMetadata(metadata, {
  create: () => new CounterComponent(),
  render: counterRender,
});
```

Input bindings are assigned before `onInit`; output subscriptions are
disconnected and emitters cleared when the component is destroyed. Component
instances, child injectors and views share one deterministic lifetime.

## Directive

```ts
import { Directive, Input, HostBinding, HostListener, getDirectiveMetadata } from 'gnome-extension-framework';

@Directive({ selector: '[gefTooltip]' })
class TooltipDirective {
  @Input() text = '';
  @HostBinding('accessible-name') accessibleName = '';
  @HostListener('button-press', ['$event']) activate(event: unknown): void {}
}

const directives = new DirectiveRegistry<StActor>().registerMetadata(
  getDirectiveMetadata(TooltipDirective)!,
  { create: () => new TooltipDirective() },
);
```

The initial selector matcher supports element names, attribute presence/value
and class selectors. Host property writes and event listeners are owned by the
native actor's destruction lifecycle.

## Pipes

Register pipe instances explicitly:

```ts
const pipes = new PipeRegistry().register('uppercase', new UppercasePipe());
```

Pure pipes cache the last result by input and argument identity. Set
`pure: false` when a transform must run on every evaluation.
