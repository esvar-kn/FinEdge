import fs from 'fs/promises';

// Serializes every write across the process so file writes never interleave.
let writeQueue = Promise.resolve();

/**
 * Reads and parses a JSON file. A missing file is treated as an empty store.
 * A corrupt file is backed up to `<file>.corrupt-<timestamp>` before returning
 * [] so the recoverable data is never silently overwritten by the next write.
 * @param {string} filePath
 * @returns {Promise<Array>}
 */
export async function readJSONFile(filePath) {
  let content;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    if (error.code === 'ENOENT') return []; // no file yet: empty store
    throw error;
  }

  try {
    return JSON.parse(content);
  } catch (parseError) {
    const backupPath = `${filePath}.corrupt-${Date.now()}`;
    try {
      await fs.copyFile(filePath, backupPath);
      console.error(`Corrupt JSON at ${filePath}; backed up to ${backupPath}. Returning [].`);
    } catch (backupError) {
      console.error(`Corrupt JSON at ${filePath}; failed to back it up:`, backupError);
    }
    return [];
  }
}

/**
 * Atomically writes JSON to a file (temp file + rename) inside the write queue.
 * Prefer updateJSONFile for read-modify-write; use this only for full overwrites.
 * @param {string} filePath
 * @param {Array} data
 * @returns {Promise<void>}
 */
export function writeJSONFile(filePath, data) {
  const run = writeQueue.then(async () => {
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tempPath, filePath);
  });
  // Keep the chain alive even if this write rejects, so later writes still run.
  writeQueue = run.catch(() => {});
  return run;
}

/**
 * Atomic read-modify-write. The whole cycle (read current state -> mutate ->
 * persist) runs inside the serialized queue, so concurrent callers can no longer
 * read the same snapshot and clobber each other's changes (lost updates).
 *
 * The mutator receives the current array and returns { data, result }:
 *   - `data`   is the full array to persist
 *   - `result` is what the caller of updateJSONFile receives
 * @param {string} filePath
 * @param {(current: Array) => ({ data: Array, result: any }) | Promise<{ data: Array, result: any }>} mutator
 * @returns {Promise<any>}
 */
export function updateJSONFile(filePath, mutator) {
  const run = writeQueue.then(async () => {
    const current = await readJSONFile(filePath);
    const { data, result } = await mutator(current);
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tempPath, filePath);
    return result;
  });
  writeQueue = run.catch(() => {});
  return run;
}
