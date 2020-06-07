const RESERVED_WORDS =
    [
        'break',
        'case',
        'catch',
        'class',
        'const',
        'continue',
        'debugger',
        'default',
        'delete',
        'do',
        'else',
        'enum',
        'export',
        'extends',
        'false',
        'finally',
        'for',
        'function',
        'if',
        'import',
        'in',
        'instanceof',
        'new',
        'null',
        'return',
        'super',
        'switch',
        'this',
        'throw',
        'true',
        'try',
        'typeof',
        'var',
        'void',
        'while',
        'with',
        'as',
        'implements',
        'interface',
        'type',
        'let',
        'package',
        'private',
        'protected',
        'public',
        'static',
        'yield',
    ];

export type Validation = { isValid: true } | { isValid: false; message: string };
export function validateToken(token: string): Validation
{
    if (!/^[a-zA-Z$_][0-9a-zA-Z$_]*$/.test(token))
        return { isValid: false, message: `${token} is not valid TypeScript variable name.` };

    if (RESERVED_WORDS.includes(token))
        return { isValid: false, message: `${token} is TypeScript reserved word.` };

    return { isValid: true };
}

export default validateToken;
