import path from 'node:path';
import { MessageChannel, receiveMessageOnPort, Worker } from 'node:worker_threads';

import type TS from 'typescript';

import { type Logger, type Options } from '../css-library/index.ts';

type WorkerData = {
  shared: SharedArrayBuffer;
  port: MessagePort;
};

type WorkerRequest = {
  filename: string;
  options: Options;
};

type MyWorker = {
  localPort: MessagePort;
  int32: Int32Array;
  w: Worker;
};

let worker: MyWorker | null = null;

export function getDtsSnapshot(
  ts: typeof TS,
  filename: string,
  _logger: Logger,
  options: Options,
): TS.IScriptSnapshot {
  if (!worker) {
    const { port1: localPort, port2: workerPort } = new MessageChannel();
    const shared = new SharedArrayBuffer(4);
    const workerData: WorkerData = { shared, port: workerPort };
    const workerPath = path.resolve(import.meta.dirname, 'worker.js');

    const w = new Worker(workerPath, { workerData, transferList: [workerPort] });

    const int32 = new Int32Array(shared);
    worker = { localPort, int32, w };

    process.on('exit', () => {
      void worker?.w.terminate();
    });
  }

  const request: WorkerRequest = { filename, options };

  worker.w.postMessage(request);
  Atomics.wait(worker.int32, 0, 0);
  const { dts } =
    receiveMessageOnPort(worker.localPort)?.message ?? ({} as { dts: string; map: string });
  return ts.ScriptSnapshot.fromString(dts);
}
