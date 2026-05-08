import { parentPort, workerData } from 'node:worker_threads';

import { generateTypesFromCss, type Options } from '../css-library/index.ts';
import { defaultLogger } from '../css-library/logger.ts';

type WorkerRequest = {
  filename: string;
  options: Options;
};

const { shared, port } = workerData;
const int32 = new Int32Array(shared);

parentPort?.on('message', (message: WorkerRequest) => {
  (async () => {
    const { filename, options } = message;

    port.postMessage(await generateTypesFromCss(filename, defaultLogger, options));
    Atomics.notify(int32, 0);
  })();
});
