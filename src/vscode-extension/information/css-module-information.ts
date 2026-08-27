import os from 'node:os';

import { type Location, Position, Range, Uri, workspace, WorkspaceEdit } from 'vscode';
import { Utils } from 'vscode-uri';

import { fileOperation, type Logger, type Options } from '../../common/index.ts';
import {
  type CssLocation,
  type CssModuleInfo,
  generateCssModuleInfo,
} from '../../css-library/index.ts';

import { cssImporter } from '../css-importer/index.ts';
import { ReadonlyUriSet } from '../helpers/index.ts';

import { type ClassUsage } from './class-usage.ts';
import { type CssInformation } from './css-information.ts';
import { extractUsage } from './extract-usage.ts';
import { toLocation } from './to-location.ts';

type LocalOrClass = { localName?: string; className?: string };

type Arguments = {
  readonly uri: Uri;
  readonly logger: Logger;
  readonly options: Options;
  readonly root: Uri;
};

export class CssModuleInformation implements CssInformation {
  public static async create({
    uri,
    logger,
    options,
    root,
  }: Arguments): Promise<CssModuleInformation | undefined> {
    try {
      const document = await workspace.openTextDocument(uri);
      const cssInfo = await generateCssModuleInfo(document.getText(), uri.fsPath, {
        options,
        logger,
        cssImporter: cssImporter({ root: Utils.dirname(uri), logger }),
        relativeTo: os.homedir(),
        root: root.fsPath,
      });

      return new CssModuleInformation(cssInfo);
    } catch (error) {
      logger.error(fileOperation(uri, 'error', error));
    }
    return undefined;
  }

  public classNames: Set<string>;

  public dtsContents: CssModuleInfo['dtsContents'];
  public locationsOfClass: ReadonlyMap<string, readonly CssLocation[]>;
  public importedFiles: ReadonlyUriSet;
  public classLocal: CssModuleInfo['classLocal'];
  public classScope: CssModuleInfo['classScope'];
  public localClass: CssModuleInfo['localClass'];
  public dtsRange: CssModuleInfo['dtsRange'];
  public dtsFilename: CssModuleInfo['dtsFilename'];
  public hasDts: boolean;

  private constructor({
    dtsFilename,
    dtsContents,
    locationsOfClass,
    importedFiles,
    classLocal,
    classScope,
    localClass,
    dtsRange,
    dtsFilename: dtsFile,
    hasDts,
  }: CssModuleInfo) {
    this.dtsFilename = dtsFilename;
    this.dtsContents = dtsContents;
    this.locationsOfClass = locationsOfClass;
    this.importedFiles = new ReadonlyUriSet(importedFiles.values().map((u) => Uri.file(u)));
    this.classLocal = classLocal;
    this.classScope = classScope;
    this.localClass = localClass;
    this.dtsRange = dtsRange;
    this.dtsFilename = dtsFile;
    this.hasDts = hasDts;

    this.classNames = new Set(locationsOfClass.keys());
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
  }: LocalOrClass & { importUri: Uri }): readonly Location[] | null {
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

  public localClassNames(localName: string): ReadonlySet<string> | undefined {
    return this.localClass.get(localName);
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
      const usages = (await extractUsage(document, importUri)).filter((usage) =>
        localNames.has(usage.localName),
      );

      return { document, usages };
    }
    return null;
  }
}
