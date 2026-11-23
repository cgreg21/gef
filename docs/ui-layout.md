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

## GTPL application containers

Use `HeaderBar` and `Sidebar` directly in templates; no TypeScript layout configuration is needed:

```html
<HeaderBar>
  <Label text="My application" />
  <Button>Menu</Button>
</HeaderBar>

<Sidebar width="220">
  <Button>Overview</Button>
  <Button>Settings</Button>
</Sidebar>
```

`HeaderBar` uses `Adw.HeaderBar` when supplied, otherwise `Gtk.HeaderBar` or a horizontal `Gtk.Box` on GTK; GNOME Shell uses a horizontal `St.BoxLayout`. Native header bars receive children in their start slot. `Sidebar` uses a vertical `Gtk.Box` or `St.BoxLayout`. They remain ordinary GTPL containers, so child ordering, bindings and lifecycle follow the normal GTPL rules. `orientation` can override the box fallback and sidebar orientation.

## GTPL Flex container

Use the native `Flex` container directly in a template:

```html
<Flex direction="column" gap="8">
  <Label>Title</Label>
  <Flex direction="row" gap="12">
    <Button>Cancel</Button>
    <Button>Save</Button>
  </Flex>
</Flex>
```

`direction` accepts `row` or `column`; `gap` is a non-negative number of pixels; `homogeneous` accepts `true` or `false` and enables equal child sizing in the native box; `align` accepts `fill`, `start`, `center` or `end`. Both renderers map these attributes to native properties. `direction` and `homogeneous` support reactive GTPL bindings. A child may set `expand="true"` to request extra space on both axes (GTK `hexpand`/`vexpand`, St `x_expand`/`y_expand`); the value can also be bound reactively. `align` controls the Flex container's own horizontal and vertical alignment in its parent, not the alignment of each child. Main-axis justification is not exposed because Gtk.Box and St.BoxLayout do not offer the same native justification property. Per-child grow weights and wrapping are also not yet part of the GTPL API.

## GTPL Grid container

Declare a grid entirely in GTPL:

```html
<Grid columns="3" gap="12">
  <Card>One</Card>
  <Card>Two</Card>
  <Card>Three</Card>
  <Card>Four</Card>
</Grid>
```

`columns` is a positive integer and `gap` is a non-negative pixel value applied to both axes. GTK uses `Gtk.Grid`; GNOME Shell 51 uses nested `St.BoxLayout` rows because St 51 has no native grid widget. The initial GTPL implementation uses fixed columns. The toolkit-independent `GridLayout` and responsive breakpoint APIs remain available for applications that need to calculate layouts from available width; native responsive reflow will be connected in a later step.

## Flex layout

`FlexLayout` calculates row or column layouts, distributes free space with `grow`, shrinks overflowing items with `shrink`, and optionally wraps items. Direction, wrapping, gap, justification and alignment accept responsive values:

```ts
import { FlexLayout } from 'gnome-extension-framework/ui';

const flex = new FlexLayout({
  direction: { base: 'column', md: 'row' },
  wrap: true,
  gap: { base: 8, md: 16 },
  justify: 'space-between',
  align: 'center',
});

const layout = flex.layout(containerWidth, containerHeight, [
  { basis: 180, grow: 1, shrink: 1, crossSize: 40 },
  { basis: 240, grow: 2, shrink: 1, crossSize: 40 },
]);
// Each item has x, y, width, height and line.
```

Supported alignment values are `start`, `center`, `end`, and `stretch`; justification supports `start`, `center`, `end`, and `space-between`. The calculation is toolkit-independent: connect its input dimensions to the native container's allocation and apply the returned item bounds in the platform renderer.
