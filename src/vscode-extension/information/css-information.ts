import os from 'node:os';

import { noop } from '@technobuddha/library';
import {
  Location,
  Position,
  Range,
  type TextDocument,
  Uri,
  workspace,
  WorkspaceEdit,
} from 'vscode';
import { Utils } from 'vscode-uri';

import { fileOperation, type Logger, type Options } from '../../common/index.ts';
import {
  type CMTDLocation,
  cssImporter,
  type CssInfo,
  generateCssInfo,
} from '../../css-library/index.ts';

import { getSourceFile, importBindingNames } from '../helpers/index.ts';

import { type ClassUsage, type Usage } from './class-usage.ts';
import { type State } from './state.ts';
import { visit } from './visit.ts';

type Arguments = {
  readonly uri: Uri;
  readonly logger: Logger;
  readonly options: Options;
  readonly root: Uri;
};

export class CssInformation implements CssInfo {
  public static async create({
    uri,
    logger,
    options,
    root,
  }: Arguments): Promise<CssInformation | undefined> {
    return workspace
      .openTextDocument(uri)
      .then(
        async (document) =>
          generateCssInfo(document.getText(), uri.fsPath, {
            options,
            logger,
            cssImporter: cssImporter({ root: Utils.dirname(uri), logger }),
            relativeTo: os.homedir(),
            root: root.fsPath,
          }).then((cssInfo) => new CssInformation(cssInfo)),
        noop,
      )
      .then((cssInfo) => (cssInfo ? new CssInformation(cssInfo) : undefined));
  }

  public dtsContents: CssInfo['dtsContents'];
  public locationsOfClass: CssInfo['locationsOfClass'];
  public includedFiles: CssInfo['includedFiles'];
  public classLocal: CssInfo['classLocal'];
  public classScope: CssInfo['classScope'];
  public localClass: CssInfo['localClass'];
  public dtsRange: CssInfo['dtsRange'];
  public dtsFilename: CssInfo['dtsFilename'];
  public hasDts: boolean;

  private constructor({
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
  }: CssInfo) {
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

  public async writeTypeDefinition(logger: Logger): Promise<void> {
    const { dtsFilename, dtsContents } = this;
    const dtsUri = Uri.file(dtsFilename);

    return workspace.openTextDocument(dtsUri).then(
      async (document) => {
        if (document.getText() !== dtsContents) {
          if (document.isDirty) {
            const we = new WorkspaceEdit();

            we.replace(
              dtsUri,
              new Range(new Position(0, 0), document.lineAt(document.lineCount - 1).range.end),
              dtsContents,
            );
            return workspace.applyEdit(we, { isRefactoring: true }).then(() => {
              logger.info(fileOperation(dtsUri, 'updated'), ' <=== workspace edit');
            });
          }
          return workspace.fs.writeFile(dtsUri, await workspace.encode(dtsContents)).then(() => {
            logger.info(fileOperation(dtsUri, 'updated'), ' <=== writefile');
          });
        }
      },
      async () =>
        workspace.fs.writeFile(dtsUri, await workspace.encode(dtsContents)).then(() => {
          logger.info(fileOperation(dtsUri, 'created'));
        }),
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
