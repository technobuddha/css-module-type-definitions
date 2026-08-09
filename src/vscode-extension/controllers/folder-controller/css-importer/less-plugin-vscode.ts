import { empty } from '@technobuddha/library';
import Less from 'less';
import { Uri, workspace } from 'vscode';

export class LessPluginVscode implements Less.Plugin {
  private readonly root: Uri;

  public constructor(root: Uri) {
    this.root = root;
  }

  public install(_less: LessStatic, pluginManager: Less.PluginManager): void {
    pluginManager.addFileManager(new FileManager(this.root));
  }
}

class FileManager extends Less.FileManager {
  private readonly root: Uri;

  public constructor(root: Uri) {
    super();
    this.root = root;
  }
  public override supports(
    filename: string,
    currentDirectory: string,
    options: Less.LoadFileOptions,
    environment: Less.Environment,
  ): boolean {
    void this.root;
    void { filename, currentDirectory, options, environment };
    return true;
  }

  public override async loadFile(
    filename: string,
    currentDirectory: string,
    _options: Less.LoadFileOptions,
    _environment: Less.Environment,
  ): Promise<Less.FileLoadResult> {
    const uri =
      currentDirectory ?
        Uri.joinPath(Uri.file(currentDirectory), filename)
      : Uri.joinPath(this.root, filename);

    return {
      filename: uri.fsPath,
      contents: await workspace.openTextDocument(uri).then(
        (document) => document.getText(),
        () => empty,
      ),
    };
  }
}
