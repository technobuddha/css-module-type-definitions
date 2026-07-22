import { toError } from '@technobuddha/library';
import { Location, Position, Range, Uri, workspace } from 'vscode';
import { Utils } from 'vscode-uri';

import { fileOperation } from '../../common/file-operation.ts';
import { type Logger } from '../../common/logger.ts';
import { type CssInfo } from '../../css-library/index.ts';

import { getSourceFile, importBindingNames } from '../helpers/index.ts';

import { type ClassUsage } from './class-usage.ts';
import { type State } from './state.ts';
import { visit } from './visit.ts';

type Arguments = CssInfo & {};

export class CssInformation implements CssInfo {
  public files: CssInfo['files'];
  public locals: CssInfo['locals'];
  public includedFiles: CssInfo['includedFiles'];
  public classLocal: CssInfo['classLocal'];
  public localClass: CssInfo['localClass'];
  public dtsRange: CssInfo['dtsRange'];
  public dtsFile: CssInfo['dtsFile'];
  public mapFile: CssInfo['mapFile'];

  public constructor({
    files,
    locals,
    includedFiles,
    classLocal,
    localClass,
    dtsRange,
    dtsFile,
    mapFile,
  }: Arguments) {
    this.files = files;
    this.locals = locals;
    this.includedFiles = includedFiles;
    this.classLocal = classLocal;
    this.localClass = localClass;
    this.dtsRange = dtsRange;
    this.dtsFile = dtsFile;
    this.mapFile = mapFile;
  }

  private async usages(
    localNames: ReadonlySet<string>,
    file: string,
    importUri: Uri,
  ): Promise<ClassUsage[]> {
    const document = await workspace.openTextDocument(file);
    const sourceFile = getSourceFile(document);
    const bindingNames = await importBindingNames(document, sourceFile, importUri);
    if (bindingNames.size > 0) {
      const state: State = {
        bindingNames,
        localNames,
        seenUsages: new Set<string>(),
        usages: [] as ClassUsage[],
        sourceFile,
      };

      visit(sourceFile, state);

      return state.usages;
    }
    return [];
  }

  public async writeTypeDefinitionFiles(logger: Logger): Promise<void> {
    const { files } = this;

    await Promise.all(
      Object.entries(files).map(async ([filename, content]) => {
        const fileUri = Uri.file(filename);

        try {
          await workspace.fs
            .readFile(fileUri)
            .then(workspace.decode)
            .then(async (existingContent) => {
              if (existingContent !== content) {
                await workspace.fs.writeFile(fileUri, await workspace.encode(content));
                logger.info(fileOperation(filename, 'updated'));
              }
            });
        } catch (e) {
          const error = toError(e);
          if (error.code === 'FileNotFound') {
            await workspace.fs.writeFile(fileUri, await workspace.encode(content));
            logger.info(fileOperation(filename, 'created'));
          } else {
            logger.error(error, `Failed to read file ${fileUri.fsPath}`);
          }
        }
      }),
    );
  }

  public cssLocations(localName: string, importUri: Uri): ReadonlyMap<string, Location[]> | null {
    const classes = this.localClass.get(localName);
    if (classes) {
      const result = new Map<string, Location[]>();

      for (const className of classes) {
        const locations = this.locals.get(className);
        if (locations) {
          result.set(
            className,
            locations.map(
              ({
                location: {
                  source,
                  range: { start, end },
                },
              }) =>
                new Location(
                  Uri.joinPath(Utils.dirname(importUri), source),
                  new Range(
                    new Position(start.line, start.column),
                    new Position(end.line, end.column),
                  ),
                ),
            ),
          );
        }
      }
      return result;
    }

    return null;
  }

  public localAliases(localName: string): ReadonlySet<string> {
    const classNames = this.localClass.get(localName);
    if (classNames) {
      return new Set(
        Array.from(classNames).flatMap((cn) => Array.from(this.classLocal.get(cn) ?? [])),
      );
    }

    return new Set();
  }

  public classAliases(className: string): ReadonlySet<string> {
    return new Set(this.classLocal.get(className));
  }

  public localDtsRanges(localName: string): Iterable<Range> {
    return this.localAliases(localName)
      .values()
      .filter((alias) => alias !== localName)
      .map((alias) => this.dtsRange.get(alias))
      .filter((range) => range != null)
      .map(
        ({ start, end }) =>
          new Range(new Position(start.line, start.column), new Position(end.line, end.column)),
      );
  }

  public classDtsRanges(className: string): Iterable<Range> {
    return this.classAliases(className)
      .values()
      .map((alias) => this.dtsRange.get(alias))
      .filter((range) => range != null)
      .map(
        ({ start, end }) =>
          new Range(new Position(start.line, start.column), new Position(end.line, end.column)),
      );
  }

  public async localUsages(localName: string, file: string, importUri: Uri): Promise<ClassUsage[]> {
    const classNames = this.localClass.get(localName);
    if (classNames) {
      const localNames = new Set(
        Array.from(classNames).flatMap((cn) => Array.from(this.classLocal.get(cn) ?? [])),
      );

      return this.usages(localNames, file, importUri);
    }

    return [];
  }

  public async classUsages(className: string, file: string, importUri: Uri): Promise<ClassUsage[]> {
    const localNames = this.classLocal.get(className);
    if (localNames) {
      return this.usages(localNames, file, importUri);
    }
    return [];
  }
}
