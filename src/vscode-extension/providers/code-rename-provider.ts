import {
  type CancellationToken,
  type Position,
  type Range,
  type RenameProvider,
  type TextDocument,
  Uri,
  workspace,
  WorkspaceEdit,
} from 'vscode';

import { type WorkspaceController } from '../controllers/workspace-controller.ts';

import { findClassUsages } from './helpers/find-class-usages.ts';
import { getClassInfo } from './helpers/get-class-info.ts';
import { classReferenceInfo } from './helpers/lib/class-reference-info.ts';

type Arguments = {
  workspaceController: WorkspaceController;
};

export class CodeRenameProvider implements RenameProvider {
  readonly #workspaceController: WorkspaceController;

  public constructor(options: Arguments) {
    this.#workspaceController = options.workspaceController;
  }

  public async prepareRename(
    document: TextDocument,
    position: Position,
    _token: CancellationToken,
  ): Promise<Range | null> {
    const folderController = this.#workspaceController.folderController(document.uri);
    if (folderController) {
      const { logger } = folderController;

      logger.debug(`prepareRename: ${document.uri.fsPath}:${position.line}:${position.character}`);
    }
    return null;
  }

  public async provideRenameEdits(
    document: TextDocument,
    position: Position,
    newName: string,
    _token: CancellationToken,
  ): Promise<WorkspaceEdit | null> {
    const folderController = this.#workspaceController.folderController(document.uri);
    if (folderController) {
      const { logger } = folderController;

      const classInfo = await getClassInfo(document, position);
      if (classInfo) {
        const { importUri, className } = classInfo;

        const types = await folderController.getTypes(importUri);
        const cri = classReferenceInfo(types, importUri, className);
        if (cri) {
          const { classNames, declarationLocations } = cri;
          const we = new WorkspaceEdit();

          for (const declarationLocation of declarationLocations) {
            logger.debug(
              `${className} ${importUri.fsPath} ${declarationLocation.uri.fsPath}:${declarationLocation.range.start.line}:${declarationLocation.range.start.character}=>${declarationLocation.range.end.line}:${declarationLocation.range.end.character} => ${newName}`,
            );
            we.replace(declarationLocation.uri, declarationLocation.range, `.${newName}`);
          }

          await folderController.getAllImports();

          for (const [file, imports] of folderController.imports) {
            if (imports.some((i) => i.fsPath === importUri.fsPath)) {
              for (const usage of await findClassUsages(
                await workspace.openTextDocument(file),
                importUri,
                classNames,
              )) {
                we.replace(Uri.file(file), usage.range, newName);
              }
            }
          }
          return we;
        }
      }
    }

    return null;
  }
}
