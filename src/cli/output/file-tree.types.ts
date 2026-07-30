import type { PreviewFileStatus } from '@/core/setup-preview.types.js';

export interface FileTreeNode {
  name: string;
  children: Map<string, FileTreeNode>;
  status?: PreviewFileStatus;
}
