import type { FileTreeNode } from '@/cli/output/file-tree.types.js';
import type { PreviewFile } from '@/core/setup-preview.types.js';

function createNode(name: string): FileTreeNode {
  return {
    name,
    children: new Map(),
  };
}

function sortedChildren(node: FileTreeNode): FileTreeNode[] {
  return [...node.children.values()].sort((left, right) => {
    const leftIsDirectory = left.children.size > 0;
    const rightIsDirectory = right.children.size > 0;

    if (leftIsDirectory !== rightIsDirectory) {
      return leftIsDirectory ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}

function renderChildren(node: FileTreeNode, prefix: string, lines: string[]): void {
  const children = sortedChildren(node);

  children.forEach((child, index) => {
    const isLast = index === children.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const isDirectory = child.children.size > 0;
    const statusLabel =
      child.status === 'conflict'
        ? ' (already exists with different content)'
        : child.status === 'unchanged'
          ? ' (unchanged)'
          : '';

    lines.push(`${prefix}${connector}${child.name}${isDirectory ? '/' : statusLabel}`);

    if (isDirectory) {
      renderChildren(child, `${prefix}${isLast ? '    ' : '│   '}`, lines);
    }
  });
}

export function formatFileTree(files: readonly PreviewFile[]): string[] {
  const root = createNode('');

  for (const file of files) {
    const segments = file.path.split('/').filter((segment) => segment.length > 0);
    let parent = root;

    segments.forEach((segment, index) => {
      let child = parent.children.get(segment);

      if (child === undefined) {
        child = createNode(segment);
        parent.children.set(segment, child);
      }

      if (index === segments.length - 1) {
        child.status = file.status;
      }

      parent = child;
    });
  }

  const lines: string[] = [];
  const topLevelNodes = sortedChildren(root);

  if (topLevelNodes.length === 1) {
    const topLevelNode = topLevelNodes[0];

    if (topLevelNode !== undefined) {
      const isDirectory = topLevelNode.children.size > 0;
      const statusLabel =
        topLevelNode.status === 'conflict'
          ? ' (already exists with different content)'
          : topLevelNode.status === 'unchanged'
            ? ' (unchanged)'
            : '';
      lines.push(`${topLevelNode.name}${isDirectory ? '/' : statusLabel}`);

      if (isDirectory) {
        renderChildren(topLevelNode, '', lines);
      }
    }
  } else {
    renderChildren(root, '', lines);
  }

  return lines;
}
