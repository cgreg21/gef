# Components, directives and pipes

GEF decorators are runtime-safe declarations that produce immutable metadata.
The compiler and GJS runtime share the same metadata module; no TypeScript
compiler or reflection is needed in the installed extension.

## Component

Declare the component in TypeScript:

```ts
import { Component, Input, Output, EventEmitter } from 'gnome-extension-framework/runtime';

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

At build time, validate the template with `compileGtplComponent` and generate
its render function. Register the runtime-safe metadata with that generated
function:

```ts
import { ComponentRegistry, type StActor } from 'gnome-extension-framework/runtime';
import counterRender from './counter-render.js';

const components = new ComponentRegistry<StActor>().registerType(CounterComponent, {
  create: () => new CounterComponent(),
  render: counterRender,
});
```

Input bindings are assigned before `onInit`; output subscriptions are
disconnected and emitters cleared when the component is destroyed. Component
instances, child injectors and views share one deterministic lifetime.

## Directive

```ts
import {
  Directive, Input, HostBinding, HostListener,
} from 'gnome-extension-framework/runtime';
import { DirectiveRegistry, type StActor } from 'gnome-extension-framework/runtime';

@Directive({ selector: '[gefTooltip]' })
class TooltipDirective {
  @Input() text = '';
  @HostBinding('accessible-name') accessibleName = '';
  @HostListener('button-press', ['$event']) activate(event: unknown): void {}
}

const directives = new DirectiveRegistry<StActor>().registerType(
  TooltipDirective,
  { create: () => new TooltipDirective() },
);
```

The initial selector matcher supports element names, attribute presence/value
and class selectors. Host properties, listeners and outputs are owned by the
native actor's destruction lifecycle.

## Pipes

Register a pipe class with its decorator metadata and an explicit factory:

```ts
import { Pipe } from 'gnome-extension-framework/runtime';
import { PipeRegistry } from 'gnome-extension-framework/runtime';

@Pipe({ name: 'uppercase' })
class UppercasePipe {
  transform(value: unknown): string {
    return String(value).toUpperCase();
  }
}

const pipes = new PipeRegistry().registerType(
  UppercasePipe,
  () => new UppercasePipe(),
);
```

Pure pipes cache the last result by input and argument identity. Set
`pure: false` when a transform must run on every evaluation.
