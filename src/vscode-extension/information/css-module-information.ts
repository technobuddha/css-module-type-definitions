import os from 'node:os';

import { Position, Range, Uri, workspace, WorkspaceEdit } from 'vscode';
import { Utils } from 'vscode-uri';

import { fileOperation, type Logger, type Options } from '../../common/index.ts';
import {
  type CssLocation,
  type CssModuleInfo,
  generateCssModuleInfo,
  type PosRange,
} from '../../css-library/index.ts';

import { cssImporter } from '../css-importer/index.ts';
import { ReadonlyUriSet } from '../helpers/index.ts';

import { type ClassUsage } from './class-usage.ts';
import { type CssInformation } from './css-information.ts';
import { extractUsage } from './extract-usage.ts';
import { LocationAndSnippet } from './location-and-snippet.ts';

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

  public classNames: ReadonlySet<string>;

  public dtsContents: string;
  public locationsOfClassName: ReadonlyMap<string, readonly CssLocation[]>;
  public importedFiles: ReadonlyUriSet;
  public localNamesOfClassName: ReadonlyMap<string, ReadonlySet<string>>;
  public scopeNameOfClassName: ReadonlyMap<string, string>;
  public classNamesOfLocalName: ReadonlyMap<string, ReadonlySet<string>>;
  public dtsRange: ReadonlyMap<string, PosRange>;
  public dtsFilename: string;
  public hasDts: boolean;

  private constructor({
    dtsFilename,
    dtsContents,
    locationsOfClassName,
    importedFiles,
    localNamesOfClassName,
    scopeNameOfClassName,
    classNamesOfLocalName,
    dtsRange,
    dtsFilename: dtsFile,
    hasDts,
  }: CssModuleInfo) {
    this.dtsFilename = dtsFilename;
    this.dtsContents = dtsContents;
    this.locationsOfClassName = locationsOfClassName;
    this.importedFiles = new ReadonlyUriSet(importedFiles.values().map((u) => Uri.file(u)));
    this.localNamesOfClassName = localNamesOfClassName;
    this.scopeNameOfClassName = scopeNameOfClassName;
    this.classNamesOfLocalName = classNamesOfLocalName;
    this.dtsRange = dtsRange;
    this.dtsFilename = dtsFile;
    this.hasDts = hasDts;

    this.classNames = new Set(locationsOfClassName.keys());
  }

  public async writeTypeDefinition(logger: Logger): Promise<void> {
    const { dtsFilename, dtsContents } = this;
    const dtsUri = Uri.file(dtsFilename);

    try {
      const document = await workspace.openTextDocument(dtsUri);
      if (document.getText() !== dtsContents) {
        if (document.isDirty) {
          const we = new WorkspaceEdit();

          we.replace(
            dtsUri,
            new Range(new Position(0, 0), document.lineAt(document.lineCount - 1).range.end),
            dtsContents,
          );
          await workspace.applyEdit(we, { isRefactoring: true }).then(() => {
            logger.info(fileOperation(dtsUri, 'updated'));
          });
          return;
        }
        await workspace.fs.writeFile(dtsUri, await workspace.encode(dtsContents)).then(() => {
          logger.info(fileOperation(dtsUri, 'updated'));
        });
      }
    } catch {
      try {
        await workspace.fs.writeFile(dtsUri, await workspace.encode(dtsContents)).then(() => {
          logger.info(fileOperation(dtsUri, 'created'));
        });
      } catch (error) {
        logger.error(fileOperation(dtsUri, 'error', error));
      }
    }
  }

  public cssLocations({
    className,
    localName,
    importUri,
  }: LocalOrClass & { importUri: Uri }): readonly LocationAndSnippet[] | null {
    if (className) {
      const locations = this.locationsOfClassName.get(className);
      if (locations) {
        return locations.map(
          ({ location, snippet }) =>
            new LocationAndSnippet(location, importUri, className, snippet),
        );
      }
    }

    if (localName) {
      const classes = this.classNamesOfLocalName.get(localName);
      if (classes) {
        const result: LocationAndSnippet[] = [];

        for (const className of classes) {
          const locations = this.locationsOfClassName.get(className);
          if (locations) {
            result.push(
              ...locations.map(({ location, snippet }) => {
                const loc: LocationAndSnippet = new LocationAndSnippet(
                  location,
                  importUri,
                  className,
                  snippet,
                );
                return loc;
              }),
            );
          }
        }
        return result;
      }
    }

    return null;
  }

  public localClassNames(localName: string): ReadonlySet<string> | undefined {
    return this.classNamesOfLocalName.get(localName);
  }

  public aliases({ className, localName }: LocalOrClass): ReadonlySet<string> {
    if (localName) {
      const classNames = this.classNamesOfLocalName.get(localName);
      if (classNames) {
        return new Set(
          Array.from(classNames).flatMap((cn) =>
            Array.from(this.localNamesOfClassName.get(cn) ?? []),
          ),
        );
      }
    }

    if (className) {
      return new Set(this.localNamesOfClassName.get(className));
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
        Array.from(this.classNamesOfLocalName.get(localName) ?? []).flatMap((cn) =>
          Array.from(this.localNamesOfClassName.get(cn) ?? []),
        )
      : className ? this.localNamesOfClassName.get(className)
      : [],
    );
  }

  public async classUsage({
    localName,
    className,
    file,
    importUri,
  }: LocalOrClass & { file: Uri; importUri: Uri }): Promise<ClassUsage | null> {
    let localNames: ReadonlySet<string> | undefined;

    if (localName) {
      const classNames = this.classNamesOfLocalName.get(localName);
      if (classNames) {
        localNames = new Set(
          Array.from(classNames).flatMap((cn) =>
            Array.from(this.localNamesOfClassName.get(cn) ?? []),
          ),
        );
      }
    }

    if (className) {
      localNames = this.localNamesOfClassName.get(className);
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
