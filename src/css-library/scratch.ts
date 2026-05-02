import path from 'node:path';
import { MessageChannel, receiveMessageOnPort, Worker } from 'node:worker_threads';

type WorkerData = {
  shared: SharedArrayBuffer;
  port: MessagePort;
};

type MyWorker = {
  localPort: MessagePort;
  int32: Int32Array;
  w: Worker;
};

let worker: MyWorker | null = null;

export function foobar(text: string): string {
  if (!worker) {
    const { port1: localPort, port2: workerPort } = new MessageChannel();
    const shared = new SharedArrayBuffer(4);
    const workerData: WorkerData = { shared, port: workerPort };
    const w = new Worker(path.join(import.meta.dirname, 'itch.ts'), {
      workerData,
      transferList: [workerPort],
    });
    const int32 = new Int32Array(shared);
    worker = { localPort, int32, w };

    process.on('exit', () => {
      void worker?.w.terminate();
    });
  }

  worker.w.postMessage(text);
  Atomics.wait(worker.int32, 0, 0);
  const message = receiveMessageOnPort(worker.localPort);
  return message?.message as string;
}
