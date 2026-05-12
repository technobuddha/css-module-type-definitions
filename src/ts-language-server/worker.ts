import { parentPort, workerData } from 'node:worker_threads';

import { defaultLogger, type Options } from '../common/index.ts';
import { generateTypesFromCss } from '../css-library/index.ts';

type WorkerRequest = {
  filename: string;
  options: Options;
};

const { shared, port } = workerData;
const int32 = new Int32Array(shared);

parentPort?.on('message', (message: WorkerRequest) => {
  (async () => {
    const { filename, options } = message;

    port.postMessage(await generateTypesFromCss(filename, { options, logger: defaultLogger }));
    Atomics.notify(int32, 0);
  })();
});
