import { toError } from '@technobuddha/library';
import { Location, Position, Range, type TextDocument, Uri, workspace } from 'vscode';
import { Utils } from 'vscode-uri';

import { fileOperation, type Logger } from '../../common/index.ts';
import { type CMTDLocation, type CssInfo } from '../../css-library/index.ts';

import { getSourceFile, importBindingNames } from '../helpers/index.ts';

import { type ClassUsage, type Usage } from './class-usage.ts';
import { type State } from './state.ts';
import { visit } from './visit.ts';

type Arguments = CssInfo & {};

export class CssInformation implements CssInfo {
  public dtsContents: CssInfo['dtsContents'];
  public locationsOfClass: CssInfo['locationsOfClass'];
  public includedFiles: CssInfo['includedFiles'];
  public classLocal: CssInfo['classLocal'];
  public classScope: CssInfo['classScope'];
  public localClass: CssInfo['localClass'];
  public dtsRange: CssInfo['dtsRange'];
  public dtsFilename: CssInfo['dtsFilename'];
  public hasDts: boolean;

  public constructor({
    dtsFilename,
    dtsContents,
    locationsOfClass,
    includedFiles,
    classLocal,
    classScope,
    localClass,
    dtsRange,
    dtsFilename: dtsFile,
    hasDts,
  }: Arguments) {
    this.dtsFilename = dtsFilename;
    this.dtsContents = dtsContents;
    this.locationsOfClass = locationsOfClass;
    this.includedFiles = includedFiles;
    this.classLocal = classLocal;
    this.classScope = classScope;
    this.localClass = localClass;
    this.dtsRange = dtsRange;
    this.dtsFilename = dtsFile;
    this.hasDts = hasDts;
  }

  public async writeTypeDefinitionFiles(logger: Logger): Promise<void> {
    const { dtsFilename, dtsContents } = this;
    const fileUri = Uri.file(dtsFilename);

    await workspace.fs
      .readFile(fileUri)
      .then(workspace.decode)
      .then(
        async (existingContent) => {
          if (existingContent !== dtsContents) {
            await workspace.fs.writeFile(fileUri, await workspace.encode(dtsContents));
            logger.info(fileOperation(dtsFilename, 'updated'));
          }
        },
        async (e) => {
          const error = toError(e);
          if (error.code === 'FileNotFound') {
            await workspace.fs.writeFile(fileUri, await workspace.encode(dtsContents));
            logger.info(fileOperation(dtsFilename, 'created'));
          } else {
            logger.error(fileOperation(fileUri, 'error', error));
          }
        },
      );
  }

  public cssLocations({
    className,
    localName,
    importUri,
  }: LocalOrClass & { importUri: Uri }): Location[] | null {
    if (className) {
      const locations = this.locationsOfClass.get(className);
      if (locations) {
        return locations.map(({ location }) => toLocation(location, importUri));
      }
    }

    if (localName) {
      const classes = this.localClass.get(localName);
      if (classes) {
        const result: Location[] = [];

        for (const className of classes) {
          const locations = this.locationsOfClass.get(className);
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

  public localNames({ localName, className }: LocalOrClass): ReadonlySet<string> {
    return new Set(
      localName ?
        Array.from(this.localClass.get(localName) ?? []).flatMap((cn) =>
          Array.from(this.classLocal.get(cn) ?? []),
        )
      : className ? this.classLocal.get(className)
      : [],
    );
  }

  public async classUsage({
    localName,
    className,
    file,
    importUri,
  }: LocalOrClass & { file: Uri; importUri: Uri }): Promise<ClassUsage | null> {
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
