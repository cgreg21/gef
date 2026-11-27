import { performance } from 'node:perf_hooks';
import { computed, effect, signal } from '../dist/runtime/src/index.js';
import { emitGtplExpression, emitGtplTemplate, parseGtpl, parseGtplExpression } from '../dist/compiler/src/index.js';

const samples = 5;

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function benchmark(name, iterations, run) {
  run(Math.max(100, Math.floor(iterations / 10)));
  const durations = [];
  for (let sample = 0; sample < samples; sample += 1) {
    const start = performance.now();
    run(iterations);
    durations.push(performance.now() - start);
  }
  const milliseconds = median(durations);
  return {
    name,
    iterations,
    medianMs: Number(milliseconds.toFixed(2)),
    operationsPerSecond: Math.round(iterations * 1000 / milliseconds),
  };
}

const template = [
  '<StBox>',
  '  @for (item of items; track item.id) {',
  '    <StLabel [text]="item.name" />',
  '    <StLabel [text]="item.description" />',
  '    <StLabel [text]="item.status" />',
  '  }',
  '  @if (ready) { <StLabel [text]="title" /> }',
  '</StBox>',
].join('\n');
const parsed = parseGtpl(template);
if (parsed.diagnostics.length > 0) {
  throw new Error(`Benchmark template is invalid: ${parsed.diagnostics.map(({ message }) => message).join('; ')}`);
}

const results = [];

const singleSubscriber = signal(0);
singleSubscriber.subscribe(() => {});
results.push(benchmark('signal.set / 1 subscriber', 30000, (count) => {
  for (let index = 0; index < count; index += 1) singleSubscriber.set(index + 1);
}));

const manySubscribers = signal(0);
for (let index = 0; index < 16; index += 1) manySubscribers.subscribe(() => {});
results.push(benchmark('signal.set / 16 subscribers', 20000, (count) => {
  for (let index = 0; index < count; index += 1) manySubscribers.set(index + 1);
}));

const dependency = signal(0);
const secondary = signal(1);
const tertiary = signal(2);
let effectRuns = 0;
const stopEffect = effect(() => {
  dependency.get();
  secondary.get();
  tertiary.get();
  effectRuns += 1;
});
results.push(benchmark('effect / 3 dependencies', 15000, (count) => {
  for (let index = 0; index < count; index += 1) dependency.set(index + 1);
}));
stopEffect();

const computedSource = signal(0);
const doubled = computed(() => computedSource.get() * 2);
let computedValue = doubled.get();
const stopComputed = doubled.subscribe((value) => { computedValue = value; });
results.push(benchmark('computed / 1 dependency', 15000, (count) => {
  for (let index = 0; index < count; index += 1) computedSource.set(index + 1);
}));
stopComputed();
doubled.dispose();

const branch = signal(false);
const left = signal(0);
const right = signal(0);
const stopDynamicEffect = effect(() => {
  if (branch.get()) right.get();
  else left.get();
});
results.push(benchmark('effect / dynamic dependency switch', 10000, (count) => {
  for (let index = 0; index < count; index += 1) branch.set(!branch.get());
}));
stopDynamicEffect();


const expressionSource = 'user.profile.name + format(user.score * multiplier, settings.precision) + (active ? labels.ready : labels.waiting)';
const expressionResult = parseGtplExpression(expressionSource);
if (expressionResult.diagnostics.length > 0 || !expressionResult.expression) {
  throw new Error('Benchmark expression is invalid.');
}
const expression = expressionResult.expression;
const expressionContext = [
  'user', 'format', 'multiplier', 'settings', 'active', 'labels',
  ...Array.from({ length: 18 }, (_, index) => `context${index}`),
];

results.push(benchmark('GTPL expression generation / default context', 20000, (count) => {
  for (let index = 0; index < count; index += 1) emitGtplExpression(expression);
}));
results.push(benchmark('GTPL expression generation / 24 context identifiers', 20000, (count) => {
  for (let index = 0; index < count; index += 1) {
    emitGtplExpression(expression, { contextIdentifiers: expressionContext });
  }
}));

results.push(benchmark('GTPL parse', 1000, (count) => {
  for (let index = 0; index < count; index += 1) parseGtpl(template);
}));
results.push(benchmark('GTPL code generation', 1500, (count) => {
  for (let index = 0; index < count; index += 1) emitGtplTemplate(parsed.nodes);
}));
results.push(benchmark('GTPL parse + code generation', 750, (count) => {
  for (let index = 0; index < count; index += 1) {
    const result = parseGtpl(template);
    emitGtplTemplate(result.nodes);
  }
}));

console.log(JSON.stringify({
  runtime: { node: process.version, platform: process.platform, arch: process.arch },
  samples,
  templateCharacters: template.length,
  effectRuns,
  computedValue,
  results,
}, null, 2));
