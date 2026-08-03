import type { RenderedFoundationFile } from '@/generators/foundation-renderer.types.js';

export type FoundationFileAction = 'create' | 'unchanged' | 'conflict' | 'overwrite';

export interface PlannedFoundationWrite extends RenderedFoundationFile {
  absolutePath: string;
  action: FoundationFileAction;
}

export interface FoundationWriteOptions {
  force?: boolean;
}

export interface FoundationWriteResult {
  created: string[];
  unchanged: string[];
  overwritten: string[];
}
