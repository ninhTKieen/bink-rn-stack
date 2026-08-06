export function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function indentation(source: string): string | number {
  const match = source.match(/\n([\t ]+)"/u);
  return match?.[1] ?? 2;
}

export function renderJson(source: string, value: unknown): string {
  return `${JSON.stringify(value, null, indentation(source))}\n`;
}

export function expoPluginName(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }

  return undefined;
}
