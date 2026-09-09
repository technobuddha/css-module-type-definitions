import os from 'node:os';

import { type Location, Position, Range, Uri, workspace, WorkspaceEdit } from 'vscode';
import { Utils } from 'vscode-uri';

import { fileOperation, type Logger, type Options } from '../../common/index.ts';
import {
  type CssModuleInfo,
  generateCssModuleInfo,
  type Range as CssRange,
} from '../../css-library/index.ts';

import { type LocalOrExport } from '../controllers/folder-controller/local-or-export.ts';
import { cssImporter } from '../css-importer/index.ts';

import { type ClassUsage } from './class-usage.ts';
import { CssGlobalInformation } from './css-global-information.ts';
import { type CssInformation, type Snippet } from './css-information.ts';
import { extractUsage } from './extract-usage.ts';

type Arguments = {
  readonly uri: Uri;
  readonly logger: Logger;
  readonly options: Options;
  readonly root: Uri;
};

export class CssModuleInformation extends CssGlobalInformation implements CssInformation {
  public static override async create({
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

  public localNamesOfExport: ReadonlyMap<string, ReadonlySet<string>>;
  public scopeNameOfExportName: ReadonlyMap<string, string>;
  public exportNamesOfLocalName: ReadonlyMap<string, ReadonlySet<string>>;
  public dtsRange: ReadonlyMap<string, CssRange>;
  public dtsFilename: string;
  public dtsContents: string;

  protected constructor(cssInfo: CssModuleInfo) {
    super(cssInfo);

    const {
      localNamesOfExport,
      scopeNameOfExportName,
      exportNamesOfLocalName,
      dtsRange,
      dtsFilename,
      dtsContents,
      hasDts,
    } = cssInfo;

    this.localNamesOfExport = localNamesOfExport;
    this.scopeNameOfExportName = scopeNameOfExportName;
    this.exportNamesOfLocalName = exportNamesOfLocalName;
    this.dtsRange = dtsRange;
    this.dtsFilename = dtsFilename;
    this.dtsContents = dtsContents;
    this.hasDts = hasDts;

    this.exportNames = new Set(this.exports.keys());
  }

  public override async writeTypeDefinition(logger: Logger): Promise<void> {
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

  public override cssSnippets({
    exportName,
    localName,
  }: LocalOrExport): readonly Snippet[] | undefined {
    if (exportName) {
      const snippets = this.exports.get(exportName)?.snippet;
      if (snippets) {
        return snippets.map((snippet) => ({ snippet, exportName }));
      }
    }

    if (localName) {
      const exportNames = this.exportNamesOfLocalName.get(localName);
      if (exportNames) {
        const result: Snippet[] = [];

        for (const exportName of exportNames) {
          const snippets = this.exports.get(exportName)?.snippet;
          if (snippets) {
            for (const snippet of snippets) {
              result.push({ snippet, exportName });
            }
          }
        }
        return result;
      }
    }

    return undefined;
  }

  public override cssLocations({
    exportName,
    localName,
  }: LocalOrExport): readonly Location[] | undefined {
    if (exportName) {
      const locations = this.exports.get(exportName)?.location;
      if (locations) {
        return locations;
      }
    }

    if (localName) {
      const exportNames = this.exportNamesOfLocalName.get(localName);
      if (exportNames) {
        const result: Location[] = [];

        for (const exportName of exportNames) {
          const locations = this.exports.get(exportName)?.location;
          if (locations) {
            result.push(...locations);
          }
        }
        return result;
      }
    }

    return undefined;
  }

  public override localExportNames(localName: string): ReadonlySet<string> | undefined {
    return this.exportNamesOfLocalName.get(localName);
  }

  public aliases({ exportName, localName }: LocalOrExport): ReadonlySet<string> {
    if (localName) {
      const exportNames = this.exportNamesOfLocalName.get(localName);
      if (exportNames) {
        return new Set(
          Array.from(exportNames).flatMap((en) =>
            Array.from(this.localNamesOfExport.get(en) ?? []),
          ),
        );
      }
    }

    if (exportName) {
      return new Set(this.localNamesOfExport.get(exportName));
    }

    return new Set();
  }

  public dtsRanges(args: { exportName: string } | { localName: string }): Iterable<Range> {
    if ('exportName' in args) {
      const { exportName } = args;
      return this.aliases({ exportName })
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

  public localNames({ localName, exportName }: LocalOrExport): ReadonlySet<string> {
    return new Set(
      localName ?
        Array.from(this.exportNamesOfLocalName.get(localName) ?? []).flatMap((cn) =>
          Array.from(this.localNamesOfExport.get(cn) ?? []),
        )
      : exportName ? this.localNamesOfExport.get(exportName)
      : [],
    );
  }

  public async classUsage({
    localName,
    exportName,
    file,
    importUri,
  }: LocalOrExport & { file: Uri; importUri: Uri }): Promise<ClassUsage | null> {
    let localNames: ReadonlySet<string> | undefined;

    if (localName) {
      const exportNames = this.exportNamesOfLocalName.get(localName);
      if (exportNames) {
        localNames = new Set(
          Array.from(exportNames).flatMap((en) =>
            Array.from(this.localNamesOfExport.get(en) ?? []),
          ),
        );
      }
    }

    if (exportName) {
      localNames = this.localNamesOfExport.get(exportName);
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
