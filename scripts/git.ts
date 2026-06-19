/* eslint-disable no-console */
import which from 'which';

async function findExecutable(cmd: string): Promise<void> {
  try {
    const path = await which(cmd);
    console.log(`Found at: ${path}`);
  } catch {
    console.log(`${cmd} not found`);
  }
}

await findExecutable('git');
