/** Error returned by the local API. */
export class ApiError extends Error {
  /** @param {string} message public message @param {number} status HTTP status @param {string} code machine code */
  constructor(message, status, code = 'REQUEST_FAILED') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Calls the local JSON API.
 * @param {string} path API path
 * @param {RequestInit} [options] fetch options
 * @returns {Promise<any>} parsed response
 */
export async function request(path, options = {}) {
  try {
    const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(data.error || `请求失败 (${response.status})`, response.status, data.code);
    return data;
  } catch (error) {
    if (error instanceof ApiError || error.name === 'AbortError') throw error;
    throw new ApiError(`无法连接后端服务：${error.message}`, 0, 'NETWORK_ERROR');
  }
}

/** Reads backend/key readiness.
 * @returns {Promise<{ok:boolean,apiKeyConfigured:boolean}>} health state
 */
export const getHealth = () => request('/api/health');

/** Saves an Agnes key.
 * @param {string} key key
 * @param {boolean} persist whether to persist in .env
 * @returns {Promise<any>} result
 */
export const configureKey = (key, persist) => request('/api/config/key', { method: 'POST', body: JSON.stringify({ key, persist }) });

/** Generates text.
 * @param {string} systemPrompt system prompt
 * @param {string} userContent user content
 * @param {number} [temperature] sampling temperature
 * @returns {Promise<string>} generated text
 */
export async function generateText(systemPrompt, userContent, temperature = 0.9) {
  const data = await request('/api/generate-text', { method: 'POST', body: JSON.stringify({ systemPrompt, userContent, temperature }) });
  return data.text;
}

/** Generates a keyframe.
 * @param {string} prompt image prompt
 * @param {string} ratio aspect ratio
 * @returns {Promise<{localUrl:string,remoteUrl:string}>} URLs
 */
export const generateImage = (prompt, ratio) => request('/api/generate-image', { method: 'POST', body: JSON.stringify({ prompt, ratio }) });

/** Creates a video task.
 * @param {object} payload task payload
 * @returns {Promise<string>} task ID
 */
export async function createVideo(payload) {
  const data = await request('/api/create-video', { method: 'POST', body: JSON.stringify(payload) });
  return data.videoId;
}

/** Queries a video task.
 * @param {string} videoId task ID
 * @param {AbortSignal} [signal] cancellation signal
 * @returns {Promise<any>} task state
 */
export const queryVideo = (videoId, signal) => request(`/api/query-video?videoId=${encodeURIComponent(videoId)}`, { signal });

/** Merges completed local videos.
 * @param {string[]} videoPaths ordered video paths
 * @returns {Promise<string>} merged URL
 */
export async function mergeVideos(videoPaths) {
  const data = await request('/api/merge-videos', { method: 'POST', body: JSON.stringify({ videoPaths }) });
  return data.mergedUrl;
}

