export type TemplateVariables = Readonly<Record<string, string>>;

export interface GeneratorFileRecipe {
  destination: string;
  template: string;
  variables?: TemplateVariables;
}

export interface RenderedGeneratorFile {
  path: string;
  content: string;
}
