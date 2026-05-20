import { type Disposable } from 'vscode';

export class Controller implements Disposable {
  protected readonly disposables: Disposable[] = [];

  public dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.length = 0;
  }
}
