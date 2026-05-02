import { parentPort, workerData } from 'node:worker_threads';

async function parse(texxt: string): Promise<string> {
  return `[[[${texxt}]]]`;
}

const { shared, port } = workerData;
const int32 = new Int32Array(shared);

parentPort?.on('message', (message) => {
  (async () => {
    const text = await parse(message);
    port.postMessage(text);
    Atomics.notify(int32, 0);
  })();
});
