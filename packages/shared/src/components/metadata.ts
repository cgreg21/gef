export interface ComponentOptions { readonly selector: string; readonly template?: string; readonly templateUrl?: string; readonly styles?: readonly string[]; }
export interface ComponentMetadata { readonly selector: string; readonly template: string; readonly templateUrl?: string; readonly styles: readonly string[]; readonly inputs: readonly string[]; readonly outputs: readonly string[]; readonly inputBindings: readonly InputBindingMetadata[]; readonly outputBindings: readonly OutputBindingMetadata[]; }
export interface DirectiveOptions { readonly selector: string; }
export interface InputBindingMetadata { readonly publicName: string; readonly member: string; }
export interface OutputBindingMetadata { readonly publicName: string; readonly member: string; }
export interface HostBindingMetadata { readonly member: string; readonly property: string; }
export interface HostListenerMetadata { readonly member: string; readonly event: string; readonly args: readonly string[]; }
export interface DirectiveMetadata { readonly selector: string; readonly inputs: readonly string[]; readonly outputs: readonly string[]; readonly inputBindings: readonly InputBindingMetadata[]; readonly outputBindings: readonly OutputBindingMetadata[]; readonly hostBindings: readonly HostBindingMetadata[]; readonly hostListeners: readonly HostListenerMetadata[]; }
export interface PipeOptions { readonly name: string; readonly pure?: boolean; }
export interface PipeMetadata { readonly name: string; readonly pure: boolean; }
export interface PipeTransform { transform(value: unknown, ...args: readonly unknown[]): unknown; }

type MemberMetadata =
  | { readonly kind: 'input' | 'output'; readonly publicName: string; readonly member: string }
  | { readonly kind: 'host-binding'; readonly property: string; readonly member: string }
  | { readonly kind: 'host-listener'; readonly event: string; readonly args: readonly string[]; readonly member: string };
const membersByPrototype = new WeakMap<object, MemberMetadata[]>();
const components = new WeakMap<Function, ComponentMetadata>();
const directives = new WeakMap<Function, DirectiveMetadata>();
const pipes = new WeakMap<Function, PipeMetadata>();

function recordMember(build: (member: string) => MemberMetadata): PropertyDecorator {
  return (prototype, key) => {
    if (typeof key !== 'string') throw new TypeError('GEF member decorators require string property names.');
    const members = membersByPrototype.get(prototype) ?? [];
    members.push(build(key));
    membersByPrototype.set(prototype, members);
  };
}
function recordMethod(build: (member: string) => MemberMetadata): MethodDecorator {
  return (prototype, key) => {
    if (typeof key !== 'string') throw new TypeError('GEF method decorators require string method names.');
    const members = membersByPrototype.get(prototype) ?? [];
    members.push(build(key));
    membersByPrototype.set(prototype, members);
  };
}
/** Declares a template input. Use as @Input() or @Input('publicName'). */
export function Input(publicName?: string): PropertyDecorator {
  return recordMember((member) => ({ kind: 'input', member, publicName: publicName ?? member }));
}
/** Declares a template output. Use as @Output() or @Output('publicName'). */
export function Output(publicName?: string): PropertyDecorator {
  return recordMember((member) => ({ kind: 'output', member, publicName: publicName ?? member }));
}
/** Binds a component or directive member to a property on its native host actor. */
export function HostBinding(property?: string): PropertyDecorator {
  return recordMember((member) => ({ kind: 'host-binding', member, property: property ?? member }));
}
/** Listens to a native host event. Arguments are expressions such as '$event'. */
export function HostListener(event: string, args: readonly string[] = []): MethodDecorator {
  return recordMethod((member) => ({ kind: 'host-listener', member, event, args: Object.freeze([...args]) }));
}

function collectMembers(target: Function): readonly MemberMetadata[] {
  const prototypes: object[] = [];
  let prototype = target.prototype as object | null;
  while (prototype && prototype !== Object.prototype) {
    prototypes.unshift(prototype);
    prototype = Object.getPrototypeOf(prototype) as object | null;
  }
  return prototypes.flatMap((item) => membersByPrototype.get(item) ?? []);
}
function names(members: readonly MemberMetadata[], kind: 'input' | 'output'): readonly string[] {
  const result = members.filter((item): item is Extract<MemberMetadata, { kind: 'input' | 'output' }> => item.kind === kind).map((item) => item.publicName);
  assertUnique(result, kind);
  return Object.freeze(result);
}
function bindings(members: readonly MemberMetadata[], kind: 'input' | 'output'): readonly (InputBindingMetadata | OutputBindingMetadata)[] {
  return Object.freeze(members
    .filter((item): item is Extract<MemberMetadata, { kind: 'input' | 'output' }> => item.kind === kind)
    .map((item) => Object.freeze({ publicName: item.publicName, member: item.member })));
}
function assertUnique(values: readonly string[], kind: string): void {
  if (new Set(values).size !== values.length) throw new TypeError(`duplicate ${kind} declaration in GEF metadata.`);
}
/** Registers a component and its template contract. */
export function Component(options: ComponentOptions): ClassDecorator {
  return (target) => {
    if (!options.selector.trim()) throw new TypeError('A component selector cannot be empty.');
    const hasInlineTemplate = typeof options.template === 'string' && options.template.trim().length > 0;
    const hasTemplateUrl = typeof options.templateUrl === 'string' && options.templateUrl.trim().length > 0;
    if (hasInlineTemplate === hasTemplateUrl) {
      throw new TypeError(`Component "${options.selector}" must declare exactly one of template or templateUrl.`);
    }
    const members = collectMembers(target);
    const inputs = names(members, 'input'); const outputs = names(members, 'output');
    components.set(target, Object.freeze({ selector: options.selector, template: options.template ?? '', ...(options.templateUrl ? { templateUrl: options.templateUrl } : {}), styles: Object.freeze([...(options.styles ?? [])]), inputs, outputs, inputBindings: bindings(members, 'input') as readonly InputBindingMetadata[], outputBindings: bindings(members, 'output') as readonly OutputBindingMetadata[] }));
  };
}
/** Declares a behavior attached to matching native or component host elements. */
export function Directive(options: DirectiveOptions): ClassDecorator {
  return (target) => {
    if (!options.selector.trim()) throw new TypeError('A directive selector cannot be empty.');
    const members = collectMembers(target);
    directives.set(target, Object.freeze({
      selector: options.selector, inputs: names(members, 'input'), outputs: names(members, 'output'),
      inputBindings: bindings(members, 'input') as readonly InputBindingMetadata[],
      outputBindings: bindings(members, 'output') as readonly OutputBindingMetadata[],
      hostBindings: Object.freeze(members.filter((item): item is Extract<MemberMetadata, { kind: 'host-binding' }> => item.kind === 'host-binding').map(({ member, property }) => Object.freeze({ member, property }))),
      hostListeners: Object.freeze(members.filter((item): item is Extract<MemberMetadata, { kind: 'host-listener' }> => item.kind === 'host-listener').map(({ member, event, args }) => Object.freeze({ member, event, args }))),
    }));
  };
}
/** Declares a template pipe. The class must implement PipeTransform. */
export function Pipe(options: PipeOptions): ClassDecorator {
  return (target) => {
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(options.name)) throw new TypeError('A pipe name must be a valid template identifier.');
    pipes.set(target, Object.freeze({ name: options.name, pure: options.pure ?? true }));
  };
}
export function getComponentMetadata(type: Function): ComponentMetadata | undefined { return components.get(type); }
export function getDirectiveMetadata(type: Function): DirectiveMetadata | undefined { return directives.get(type); }
export function getPipeMetadata(type: Function): PipeMetadata | undefined { return pipes.get(type); }

