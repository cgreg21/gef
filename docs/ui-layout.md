# UI layout and responsive behavior

The `gnome-extension-framework/ui` entry point exports a small toolkit-independent layout API. It uses the width of the available native widget or window, not browser media queries.

## Breakpoints

The default mobile-first breakpoints are:

| Name | Minimum width |
| --- | ---: |
| `xs` | 0 |
| `sm` | 576 |
| `md` | 768 |
| `lg` | 992 |
| `xl` | 1200 |
| `xxl` | 1400 |

Use `getBreakpoint(width)` to determine the active breakpoint and `resolveResponsiveValue` to resolve a scalar or responsive map:

```ts
import { getBreakpoint, resolveResponsiveValue } from 'gnome-extension-framework/ui';

const breakpoint = getBreakpoint(820); // md
const columns = resolveResponsiveValue({ base: 1, sm: 2, lg: 4 }, 820); // 2
```

Responsive maps are mobile-first: `base` is the fallback, and the last configured breakpoint at or below the current width wins.

## Grid calculation

`GridLayout` computes row and column positions for a collection of items. Columns and gaps can both change at breakpoints:

```ts
import { GridLayout } from 'gnome-extension-framework/ui';

const grid = new GridLayout({
  columns: { base: 1, sm: 2, lg: 3, xl: 4 },
  gap: { base: 8, md: 16 },
});

// Recalculate when the native container's allocated width changes.
const layout = grid.layout(containerWidth, items.length);
// layout.items[n] contains the item's zero-based row and column.
```

## Observing width changes

Connect the native widget's width/allocation notification to `BreakpointObserver.update(width)`. Subscribers are notified only when the active breakpoint changes:

```ts
import { BreakpointObserver } from 'gnome-extension-framework/ui';

const breakpoints = new BreakpointObserver();
const subscription = breakpoints.subscribe(({ breakpoint, width }) => {
  // Update the view for the new available width.
});

// Call this from the platform's native size/allocation callback.
breakpoints.update(containerWidth);

// On teardown:
subscription.unsubscribe();
```

The layout engine deliberately does not install browser APIs or guess a native widget lifecycle. The GNOME Shell / GTK view owns the size notification and calls the observer; this keeps the calculation identical on both renderers.
