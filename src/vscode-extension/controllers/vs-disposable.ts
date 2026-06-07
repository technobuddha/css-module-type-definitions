import { type Disposable } from 'vscode';

export class VSDisposable implements Disposable {
  protected readonly disposables: Disposable[] = [];

  public async dispose(): Promise<void> {
    for (const disposable of this.disposables) {
      await disposable.dispose();
    }
    this.disposables.length = 0;
  }
}
