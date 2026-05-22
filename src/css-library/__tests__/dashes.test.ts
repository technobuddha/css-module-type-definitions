import { dashes } from '../dashes.ts';

describe('dashes', () => {
  test('converts single dashed segment to camel case', () => {
    expect(dashes('button-primary')).toBe('buttonPrimary');
  });

  test('converts multiple dashed segments to camel case', () => {
    expect(dashes('button-primary-large')).toBe('buttonPrimaryLarge');
  });

  test('collapses repeated dashes before a segment', () => {
    expect(dashes('button--primary---large')).toBe('buttonPrimaryLarge');
  });

  test('leaves strings with no dashes unchanged', () => {
    expect(dashes('buttonPrimary')).toBe('buttonPrimary');
  });

  test('uppercases first segment character when string starts with dashes', () => {
    expect(dashes('--button-primary')).toBe('ButtonPrimary');
  });

  test('keeps trailing dashes when no following character exists', () => {
    expect(dashes('button-primary--')).toBe('buttonPrimary--');
  });

  test('handles underscores and digits after dashes', () => {
    expect(dashes('button-_2-primary')).toBe('button_2Primary');
  });
});
