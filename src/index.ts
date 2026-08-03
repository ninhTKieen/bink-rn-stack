export { detectPackageManager } from '@/core/detect-package-manager.js';
export type {
  PackageManagerDetection,
  PackageManagerDetectionSource,
  PackageManagerName,
} from '@/core/detect-package-manager.types.js';
export { detectProject, ProjectDetectionError } from '@/core/detect-project.js';
export type {
  ProjectDetection,
  ProjectDetectionErrorCode,
  ProjectKind,
} from '@/core/detect-project.types.js';
export { buildSetupPreview } from '@/core/setup-preview.js';
export type {
  PreviewDependency,
  PreviewDependencyStatus,
  PreviewFile,
  PreviewFileStatus,
  SetupPreview,
} from '@/core/setup-preview.types.js';
export { createI18nFileRecipes, renderI18nFoundation } from '@/generators/i18n/i18n-generator.js';
export type {
  I18nFileRecipe,
  I18nGeneratorOptions,
  RenderedI18nFile,
} from '@/generators/i18n/i18n-generator.types.js';
export {
  createTanstackQueryFileRecipes,
  renderTanstackQueryFoundation,
} from '@/generators/tanstack-query/tanstack-query-generator.js';
export type {
  RenderedTanstackQueryFile,
  TanstackQueryFileRecipe,
  TanstackQueryGeneratorOptions,
} from '@/generators/tanstack-query/tanstack-query-generator.types.js';
export {
  createUnistylesFileRecipes,
  renderUnistylesFoundation,
} from '@/generators/unistyles/unistyles-generator.js';
export type {
  RenderedUnistylesFile,
  UnistylesFileRecipe,
  UnistylesGeneratorOptions,
} from '@/generators/unistyles/unistyles-generator.types.js';
export { STACK_MODULE_NAMES, STACK_MODULES } from '@/modules/stack-module.js';
export type {
  ModuleSelectionMode,
  StackModuleDefinition,
  StackModuleName,
} from '@/modules/stack-module.types.js';
export {
  createAxiosFileRecipes,
  renderAxiosFoundation,
} from '@/generators/axios/axios-generator.js';
export type {
  AxiosFileRecipe,
  AxiosGeneratorOptions,
  RenderedAxiosFile,
} from '@/generators/axios/axios-generator.types.js';
