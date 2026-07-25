export const CONFIG_EXTENSIONS = ['.js', '.mjs', '.ts', '.cjs', '.mts', '.cts'] as const;

export const CODE_EXTENSIONS = [...CONFIG_EXTENSIONS, '.tsx', '.jsx'] as const;

export const CSS_EXTENSIONS = ['.css', '.less', '.sass', '.scss', '.styl', '.stylus'] as const;

export const MODULE_PATTERN = '*.module' as const;
