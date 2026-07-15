const fs = require('fs-extra');
const path = require('path');

/** @typedef {{getKey: () => string, setKey: (key: string, persist?: boolean) => Promise<void>, hasKey: () => boolean}} ConfigStore */

/** Creates an in-memory Agnes key store with optional .env persistence.
 * @param {string} initialKey key loaded from the environment
 * @returns {ConfigStore} key store
 */
function createConfigStore(initialKey = '') {
  let apiKey = initialKey.trim();

  return {
    /** @returns {string} current API key */
    getKey: () => apiKey,

    /** @returns {boolean} whether a key is configured */
    hasKey: () => Boolean(apiKey),

    /** Validates and stores an Agnes API key.
     * @param {string} key Agnes API key
     * @param {boolean} persist whether to write backend/.env
     * @returns {Promise<void>}
     */
    async setKey(key, persist = false) {
      const normalized = String(key || '').trim();
      if (!/^sk-[A-Za-z0-9_-]{16,}$/.test(normalized)) {
        const error = new Error('API Key 格式无效，应以 sk- 开头且长度不少于 19 位');
        error.status = 400;
        throw error;
      }
      apiKey = normalized;
      if (persist) {
        const envPath = path.join(__dirname, '..', '.env');
        await fs.writeFile(envPath, `AGNES_API_KEY=${normalized}\n`, { encoding: 'utf8', mode: 0o600 });
      }
    },
  };
}

module.exports = { createConfigStore };

