export function dashes(word: string): string {
  return word.replaceAll(/-+(\w)/gv, (_match: string, firstLetter: string) =>
    firstLetter.toUpperCase(),
  );
}
