import { toError } from '@technobuddha/library';
import { Location, Position, Range, type TextDocument, Uri, workspace } from 'vscode';
import { Utils } from 'vscode-uri';

import { fileOperation } from '../../common/file-operation.ts';
import { type Logger } from '../../common/logger.ts';
import { type CMTDLocation, type CssInfo } from '../../css-library/index.ts';

import { getSourceFile, importBindingNames } from '../helpers/index.ts';

import { type ClassUsage, type Usage } from './class-usage.ts';
import { type State } from './state.ts';
import { visit } from './visit.ts';

type Arguments = CssInfo & {};

export class CssInformation implements CssInfo {
  public files: CssInfo['files'];
  public classLocations: CssInfo['classLocations'];
  public includedFiles: CssInfo['includedFiles'];
  public classLocal: CssInfo['classLocal'];
  public localClass: CssInfo['localClass'];
  public dtsRange: CssInfo['dtsRange'];
  public dtsFile: CssInfo['dtsFile'];
  public mapFile: CssInfo['mapFile'];
  public hasDts: boolean;
  public hasMap: boolean;

  public constructor({
    files,
    classLocations,
    includedFiles,
    classLocal,
    localClass,
    dtsRange,
    dtsFile,
    mapFile,
    hasDts,
    hasMap,
  }: Arguments) {
    this.files = files;
    this.classLocations = classLocations;
    this.includedFiles = includedFiles;
    this.classLocal = classLocal;
    this.localClass = localClass;
    this.dtsRange = dtsRange;
    this.dtsFile = dtsFile;
    this.mapFile = mapFile;
    this.hasDts = hasDts;
    this.hasMap = hasMap;
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

  public cssLocations({
    className,
    localName,
    importUri,
  }: LocalOrClass & { importUri: Uri }): Location[] | null {
    if (className) {
      const locations = this.classLocations.get(className);
      if (locations) {
        return locations.map(({ location }) => toLocation(location, importUri));
      }
    }

    if (localName) {
      const classes = this.localClass.get(localName);
      if (classes) {
        const result: Location[] = [];

        for (const className of classes) {
          const locations = this.classLocations.get(className);
          if (locations) {
            result.push(...locations.map(({ location }) => toLocation(location, importUri)));
          }
        }
        return result;
      }
    }

    return null;
  }

  public aliases({ className, localName }: LocalOrClass): ReadonlySet<string> {
    if (localName) {
      const classNames = this.localClass.get(localName);
      if (classNames) {
        return new Set(
          Array.from(classNames).flatMap((cn) => Array.from(this.classLocal.get(cn) ?? [])),
        );
      }
    }

    if (className) {
      return new Set(this.classLocal.get(className));
    }

    return new Set();
  }

  public dtsRanges(args: { className: string } | { localName: string }): Iterable<Range> {
    if ('className' in args) {
      const { className } = args;
      return this.aliases({ className })
        .values()
        .map((alias) => this.dtsRange.get(alias))
        .filter((range) => range != null)
        .map(
          ({ start, end }) =>
            new Range(new Position(start.line, start.column), new Position(end.line, end.column)),
        );
    }

    if ('localName' in args) {
      const { localName } = args;
      return this.aliases({ localName })
        .values()
        .filter((alias) => alias !== localName)
        .map((alias) => this.dtsRange.get(alias))
        .filter((range) => range != null)
        .map(
          ({ start, end }) =>
            new Range(new Position(start.line, start.column), new Position(end.line, end.column)),
        );
    }

    return [];
  }

  public async classUsage({
    localName,
    className,
    file,
    importUri,
  }: LocalOrClass & { file: string; importUri: Uri }): Promise<ClassUsage | null> {
    let localNames: Set<string> | undefined;

    if (localName) {
      const classNames = this.localClass.get(localName);
      if (classNames) {
        localNames = new Set(
          Array.from(classNames).flatMap((cn) => Array.from(this.classLocal.get(cn) ?? [])),
        );
      }
    }

    if (className) {
      localNames = this.classLocal.get(className);
    }

    if (localNames) {
      const document = await workspace.openTextDocument(file);
      const usages = (await this.usages({ document, importUri })).filter((usage) =>
        localNames.has(usage.localName),
      );

      return { document, usages };
    }
    return null;
  }

  public async usages({
    document,
    importUri,
  }: {
    document: TextDocument;
    importUri: Uri;
  }): Promise<Usage[]> {
    const sourceFile = getSourceFile(document);
    const bindingNames = await importBindingNames(document, sourceFile, importUri);
    if (bindingNames.size > 0) {
      const state: State = {
        bindingNames,
        seenUsages: new Set<string>(),
        usages: [],
        sourceFile,
      };

      visit(sourceFile, state);

      return state.usages;
    }

    return [];
  }
}

type LocalOrClass = { localName?: string; className?: string };

function toLocation(location: CMTDLocation, importUri: Uri): Location {
  const { source, range } = location;
  return new Location(
    Uri.joinPath(Utils.dirname(importUri), source),
    new Range(
      new Position(range.start.line, range.start.column),
      new Position(range.end.line, range.end.column),
    ),
  );
}
