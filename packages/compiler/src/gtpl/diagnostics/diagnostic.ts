import type { SourceSpan } from '../source/span.js';

export interface Diagnostic {
  readonly code: string;
  readonly message: string;
  readonly span: SourceSpan;
}
