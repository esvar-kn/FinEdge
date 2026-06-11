import fs from 'fs/promises';

let writeQueue = Promise.resolve();

/**
 * Safely reads and parses a JSON file. Returns [] if file does not exist or parsing fails.
 * @param {string} filePath 
 * @returns {Promise<Array>}
 */
export async function readJSONFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // If file is missing or corrupted, fallback to empty array
    return [];
  }
}

/**
 * Safely writes JSON data to a file using an atomic rename pattern inside a lock queue.
 * @param {string} filePath 
 * @param {Array} data 
 * @returns {Promise<void>}
 */
export function writeJSONFile(filePath, data) {
  writeQueue = writeQueue.then(async () => {
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tempPath, filePath);
  }).catch((err) => {
    console.error(`Error safely writing JSON to ${filePath}:`, err);
    throw err;
  });
  return writeQueue;
}
