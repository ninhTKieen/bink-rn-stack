export type StackModuleName = 'axios' | 'unistyles' | 'zustand' | 'tanstack-query' | 'i18n';

export interface StackModuleDefinition {
  name: StackModuleName;
  label: string;
  description: string;
}

export type ModuleSelectionMode = 'all' | 'custom';
