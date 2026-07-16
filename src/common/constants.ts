export const CONFIG_EXTENSIONS = ['.js', '.mjs', '.ts', '.cjs', '.mts', '.cts'] as const;
export const CODE_EXTENSIONS = [...CONFIG_EXTENSIONS, '.tsx', '.jsx'] as const;
