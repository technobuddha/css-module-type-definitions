import { isValidToken } from '../is-valid-token.ts';

describe('isValidToken', () => {
  describe('valid identifiers', () => {
    test('should accept simple identifiers', () => {
      expect(isValidToken('foo')).toBeTrue();
      expect(isValidToken('bar')).toBeTrue();
      expect(isValidToken('myClass')).toBeTrue();
      expect(isValidToken('myVariable')).toBeTrue();
    });

    test('should accept identifiers starting with underscore', () => {
      expect(isValidToken('_private')).toBeTrue();
      expect(isValidToken('_')).toBeTrue();
      expect(isValidToken('__proto__')).toBeTrue();
      expect(isValidToken('_123')).toBeTrue();
    });

    test('should accept identifiers starting with dollar sign', () => {
      expect(isValidToken('$element')).toBeTrue();
      expect(isValidToken('$')).toBeTrue();
      expect(isValidToken('$$')).toBeTrue();
      expect(isValidToken('$_')).toBeTrue();
      expect(isValidToken('$123')).toBeTrue();
    });

    test('should accept identifiers with numbers', () => {
      expect(isValidToken('class123')).toBeTrue();
      expect(isValidToken('var1')).toBeTrue();
      expect(isValidToken('test2test')).toBeTrue();
      expect(isValidToken('a1b2c3')).toBeTrue();
    });

    test('should accept mixed case identifiers', () => {
      expect(isValidToken('MyClass')).toBeTrue();
      expect(isValidToken('myVariable')).toBeTrue();
      expect(isValidToken('CONSTANT')).toBeTrue();
      expect(isValidToken('MixedCASE123')).toBeTrue();
    });

    test('should accept identifiers with underscores and dollar signs', () => {
      expect(isValidToken('_$test')).toBeTrue();
      expect(isValidToken('$_test')).toBeTrue();
      expect(isValidToken('my_variable')).toBeTrue();
      expect(isValidToken('MY_CONSTANT')).toBeTrue();
      expect(isValidToken('test$var_123')).toBeTrue();
    });

    test('should accept single character identifiers', () => {
      expect(isValidToken('a')).toBeTrue();
      expect(isValidToken('Z')).toBeTrue();
      expect(isValidToken('_')).toBeTrue();
      expect(isValidToken('$')).toBeTrue();
    });
  });

  describe('invalid identifiers - syntax', () => {
    test('should reject identifiers starting with numbers', () => {
      expect(isValidToken('123abc')).toBeFalse();
      expect(isValidToken('1test')).toBeFalse();
      expect(isValidToken('0')).toBeFalse();
      expect(isValidToken('9variable')).toBeFalse();
    });

    test('should reject identifiers with hyphens', () => {
      expect(isValidToken('my-class')).toBeFalse();
      expect(isValidToken('test-variable')).toBeFalse();
      expect(isValidToken('kebab-case')).toBeFalse();
      expect(isValidToken('-test')).toBeFalse();
      expect(isValidToken('test-')).toBeFalse();
    });

    test('should reject identifiers with spaces', () => {
      expect(isValidToken('my class')).toBeFalse();
      expect(isValidToken('test variable')).toBeFalse();
      expect(isValidToken(' test')).toBeFalse();
      expect(isValidToken('test ')).toBeFalse();
    });

    test('should reject identifiers with special characters', () => {
      expect(isValidToken('my@class')).toBeFalse();
      expect(isValidToken('test#var')).toBeFalse();
      expect(isValidToken('var!')).toBeFalse();
      expect(isValidToken('test%')).toBeFalse();
      expect(isValidToken('my.property')).toBeFalse();
      expect(isValidToken('test&var')).toBeFalse();
      expect(isValidToken('var*')).toBeFalse();
      expect(isValidToken('test+')).toBeFalse();
      expect(isValidToken('var=')).toBeFalse();
      expect(isValidToken('test[')).toBeFalse();
      expect(isValidToken('var]')).toBeFalse();
      expect(isValidToken('test{')).toBeFalse();
      expect(isValidToken('var}')).toBeFalse();
      expect(isValidToken('test|')).toBeFalse();
      expect(isValidToken('var\\')).toBeFalse();
      expect(isValidToken('test/')).toBeFalse();
      expect(isValidToken('var?')).toBeFalse();
      expect(isValidToken('test<')).toBeFalse();
      expect(isValidToken('var>')).toBeFalse();
      expect(isValidToken('test,')).toBeFalse();
      expect(isValidToken('var;')).toBeFalse();
      expect(isValidToken('test:')).toBeFalse();
      expect(isValidToken('var"')).toBeFalse();
      expect(isValidToken("test'")).toBeFalse();
    });

    test('should reject empty string', () => {
      expect(isValidToken('')).toBeFalse();
    });
  });

  describe('ECMAScript reserved words', () => {
    test('should reject control flow keywords', () => {
      expect(isValidToken('if')).toBeFalse();
      expect(isValidToken('else')).toBeFalse();
      expect(isValidToken('for')).toBeFalse();
      expect(isValidToken('while')).toBeFalse();
      expect(isValidToken('do')).toBeFalse();
      expect(isValidToken('switch')).toBeFalse();
      expect(isValidToken('case')).toBeFalse();
      expect(isValidToken('default')).toBeFalse();
      expect(isValidToken('break')).toBeFalse();
      expect(isValidToken('continue')).toBeFalse();
      expect(isValidToken('return')).toBeFalse();
    });

    test('should reject function and class keywords', () => {
      expect(isValidToken('function')).toBeFalse();
      expect(isValidToken('class')).toBeFalse();
      expect(isValidToken('extends')).toBeFalse();
      expect(isValidToken('super')).toBeFalse();
      expect(isValidToken('this')).toBeFalse();
      expect(isValidToken('new')).toBeFalse();
    });

    test('should reject variable declaration keywords', () => {
      expect(isValidToken('var')).toBeFalse();
      expect(isValidToken('let')).toBeFalse();
      expect(isValidToken('const')).toBeFalse();
    });

    test('should reject module keywords', () => {
      expect(isValidToken('import')).toBeFalse();
      expect(isValidToken('export')).toBeFalse();
    });

    test('should reject exception handling keywords', () => {
      expect(isValidToken('try')).toBeFalse();
      expect(isValidToken('catch')).toBeFalse();
      expect(isValidToken('finally')).toBeFalse();
      expect(isValidToken('throw')).toBeFalse();
    });

    test('should reject boolean and null literals', () => {
      expect(isValidToken('true')).toBeFalse();
      expect(isValidToken('false')).toBeFalse();
      expect(isValidToken('null')).toBeFalse();
    });

    test('should reject operator keywords', () => {
      expect(isValidToken('typeof')).toBeFalse();
      expect(isValidToken('instanceof')).toBeFalse();
      expect(isValidToken('in')).toBeFalse();
      expect(isValidToken('delete')).toBeFalse();
      expect(isValidToken('void')).toBeFalse();
    });

    test('should reject other reserved words', () => {
      expect(isValidToken('debugger')).toBeFalse();
      expect(isValidToken('with')).toBeFalse();
      expect(isValidToken('yield')).toBeFalse();
      expect(isValidToken('await')).toBeFalse();
      expect(isValidToken('enum')).toBeFalse();
    });
  });

  describe('TypeScript-specific reserved words', () => {
    test('should reject TypeScript type keywords', () => {
      expect(isValidToken('type')).toBeFalse();
      expect(isValidToken('interface')).toBeFalse();
    });

    test('should reject TypeScript contextual keywords', () => {
      expect(isValidToken('as')).toBeFalse();
    });

    test('should reject strict mode reserved words', () => {
      expect(isValidToken('implements')).toBeFalse();
      expect(isValidToken('package')).toBeFalse();
      expect(isValidToken('private')).toBeFalse();
      expect(isValidToken('protected')).toBeFalse();
      expect(isValidToken('public')).toBeFalse();
      expect(isValidToken('static')).toBeFalse();
    });
  });

  describe('edge cases', () => {
    test('should accept words similar to reserved words', () => {
      expect(isValidToken('className')).toBeTrue();
      expect(isValidToken('forEach')).toBeTrue();
      expect(isValidToken('myFunction')).toBeTrue();
      expect(isValidToken('isTrue')).toBeTrue();
      expect(isValidToken('isFalse')).toBeTrue();
      expect(isValidToken('varName')).toBeTrue();
      expect(isValidToken('letValue')).toBeTrue();
      expect(isValidToken('constValue')).toBeTrue();
    });

    test('should accept reserved words as part of identifier', () => {
      expect(isValidToken('ifCondition')).toBeTrue();
      expect(isValidToken('forLoop')).toBeTrue();
      expect(isValidToken('whileLoop')).toBeTrue();
      expect(isValidToken('myClass2')).toBeTrue();
      expect(isValidToken('functionName')).toBeTrue();
      expect(isValidToken('tryCatch')).toBeTrue();
    });

    test('should reject reserved words with different casing (case-sensitive)', () => {
      // Reserved words are case-sensitive in JavaScript
      expect(isValidToken('IF')).toBeTrue();
      expect(isValidToken('Class')).toBeTrue();
      expect(isValidToken('TRUE')).toBeTrue();
      expect(isValidToken('FALSE')).toBeTrue();
      expect(isValidToken('NULL')).toBeTrue();
      expect(isValidToken('For')).toBeTrue();
    });

    test('should handle very long identifiers', () => {
      const longValid = 'a'.repeat(1000);
      expect(isValidToken(longValid)).toBeTrue();

      const longWithNumbers = `a${'1'.repeat(999)}`;
      expect(isValidToken(longWithNumbers)).toBeTrue();

      const longWithUnderscore = `_${'a'.repeat(999)}`;
      expect(isValidToken(longWithUnderscore)).toBeTrue();
    });

    test('should handle Unicode characters correctly', () => {
      // The regex pattern only allows ASCII letters, digits, $, and _
      expect(isValidToken('café')).toBeFalse();
      expect(isValidToken('naïve')).toBeFalse();
      expect(isValidToken('日本語')).toBeFalse();
      expect(isValidToken('αβγ')).toBeFalse();
    });
  });

  describe('practical CSS class name scenarios', () => {
    test('should accept typical CSS class names (converted to camelCase)', () => {
      expect(isValidToken('container')).toBeTrue();
      expect(isValidToken('button')).toBeTrue();
      expect(isValidToken('navBar')).toBeTrue();
      expect(isValidToken('menuItem')).toBeTrue();
      expect(isValidToken('footerContent')).toBeTrue();
    });

    test('should reject kebab-case class names', () => {
      expect(isValidToken('nav-bar')).toBeFalse();
      expect(isValidToken('menu-item')).toBeFalse();
      expect(isValidToken('footer-content')).toBeFalse();
    });

    test('should accept BEM-style naming (when converted)', () => {
      expect(isValidToken('block__element')).toBeTrue();
      expect(isValidToken('block__element_modifier')).toBeTrue();
      expect(isValidToken('button_primary')).toBeTrue();
    });

    test('should reject class names with invalid characters', () => {
      expect(isValidToken('button:hover')).toBeFalse();
      expect(isValidToken('nav.active')).toBeFalse();
      expect(isValidToken('item[0]')).toBeFalse();
    });
  });
});
