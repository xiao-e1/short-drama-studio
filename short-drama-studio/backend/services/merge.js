const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const { v4: uuid } = require('uuid');
const { HttpError } = require('../middleware/errors');

/** Resolves and validates an outputs URL.
 * @param {string} url client-provided local URL
 * @param {string} outputsDir absolute outputs directory
 * @returns {string} validated absolute path
 */
function resolveOutputPath(url, outputsDir) {
  if (typeof url !== 'string' || !url.startsWith('/outputs/')) throw new HttpError(400, '视频路径必须位于 /outputs/', 'INVALID_VIDEO_PATH');
  const absolute = path.resolve(outputsDir, path.basename(url));
  if (path.dirname(absolute) !== path.resolve(outputsDir) || path.extname(absolute).toLowerCase() !== '.mp4') {
    throw new HttpError(400, '视频路径无效', 'INVALID_VIDEO_PATH');
  }
  if (!fs.existsSync(absolute)) throw new HttpError(404, `找不到视频片段: ${path.basename(url)}`, 'VIDEO_NOT_FOUND');
  return absolute;
}

/** Merges MP4 files using ffmpeg's concat demuxer.
 * @param {string[]} videoPaths local /outputs URLs in playback order
 * @param {string} outputsDir absolute outputs directory
 * @returns {Promise<string>} merged local URL
 */
async function mergeVideos(videoPaths, outputsDir) {
  const inputs = videoPaths.map((url) => resolveOutputPath(url, outputsDir));
  const id = uuid();
  const listPath = path.join(outputsDir, `.merge-${id}.txt`);
  const outputName = `merged-${id}.mp4`;
  const outputPath = path.join(outputsDir, outputName);
  const list = inputs.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join('\n');
  await fs.writeFile(listPath, list, 'utf8');

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(process.env.FFMPEG_PATH || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', '-movflags', '+faststart', '-y', outputPath]);
      let stderr = '';
      child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      child.on('error', (error) => reject(new HttpError(503, `未找到 ffmpeg。请先安装 ffmpeg，或设置 FFMPEG_PATH。${error.message}`, 'FFMPEG_NOT_FOUND')));
      child.on('close', (code) => code === 0 ? resolve() : reject(new HttpError(500, `视频合并失败: ${stderr.slice(-500)}`, 'MERGE_FAILED')));
    });
    return `/outputs/${outputName}`;
  } finally {
    await fs.remove(listPath).catch(() => {});
  }
}

module.exports = { mergeVideos, resolveOutputPath };

