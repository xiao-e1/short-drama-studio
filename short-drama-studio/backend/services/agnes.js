const fetch = require('node-fetch');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuid } = require('uuid');
const { HttpError } = require('../middleware/errors');

const AGNES_BASE_URL = process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com';

/** @typedef {{retries?: number, retryDelayMs?: number}} RequestOptions */

/** Waits for a number of milliseconds.
 * @param {number} milliseconds delay
 * @returns {Promise<void>}
 */
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/** Creates an Agnes API client.
 * @param {{getApiKey: () => string, outputsDir: string, fetchImpl?: typeof fetch}} options dependencies
 * @returns {{post: Function, queryVideo: Function, download: Function}}
 */
function createAgnesClient({ getApiKey, outputsDir, fetchImpl = fetch }) {
  /** Returns the configured API key.
   * @returns {string} key
   */
  function requireKey() {
    const key = getApiKey();
    if (!key) throw new HttpError(401, '请先设置 Agnes API Key', 'API_KEY_REQUIRED');
    return key;
  }

  /** Calls an Agnes JSON endpoint with bounded retries.
   * @param {string} endpoint endpoint path
   * @param {Record<string, unknown>} body request payload
   * @param {RequestOptions} [options] retry settings
   * @returns {Promise<any>} parsed response
   */
  async function post(endpoint, body, options = {}) {
    const retries = options.retries ?? 2;
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const response = await fetchImpl(`${AGNES_BASE_URL}${endpoint}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${requireKey()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (response.ok) return await response.json();
        const detail = await response.text().catch(() => '');
        if (response.status === 401 || response.status === 403) {
          throw new HttpError(401, 'Agnes API Key 无效或无权限', 'INVALID_API_KEY');
        }
        if (response.status === 429 && attempt < retries) {
          await sleep(options.retryDelayMs ?? 3000 * (attempt + 1));
          continue;
        }
        throw new HttpError(response.status >= 500 ? 502 : response.status, `Agnes API 请求失败 (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`, 'AGNES_ERROR');
      } catch (error) {
        if (error instanceof HttpError) throw error;
        lastError = error;
        if (attempt < retries) {
          await sleep(1000 * (attempt + 1));
          continue;
        }
      }
    }
    throw new HttpError(502, `无法连接 Agnes API: ${lastError?.message || '未知网络错误'}`, 'AGNES_UNREACHABLE');
  }

  /** Queries a video task.
   * @param {string} videoId Agnes task ID
   * @returns {Promise<any>} task response
   */
  async function queryVideo(videoId) {
    const response = await fetchImpl(`${AGNES_BASE_URL}/agnesapi?video_id=${encodeURIComponent(videoId)}`, {
      headers: { Authorization: `Bearer ${requireKey()}` },
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new HttpError(response.status === 401 ? 401 : 502, `查询视频失败 (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`, 'VIDEO_QUERY_FAILED');
    }
    return response.json();
  }

  /** Downloads a generated asset to outputs.
   * @param {string} remoteUrl public asset URL
   * @param {'.png'|'.mp4'} extension output extension
   * @returns {Promise<string>} local URL
   */
  async function download(remoteUrl, extension) {
    const response = await fetchImpl(remoteUrl);
    if (!response.ok) throw new HttpError(502, `下载生成资源失败 (${response.status})`, 'DOWNLOAD_FAILED');
    const filename = `${uuid()}${extension}`;
    await fs.writeFile(path.join(outputsDir, filename), await response.buffer());
    return `/outputs/${filename}`;
  }

  return { post, queryVideo, download };
}

module.exports = { createAgnesClient };

