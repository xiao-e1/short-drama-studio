const express = require('express');
const { asyncHandler, HttpError } = require('../middleware/errors');
const { mergeVideos } = require('../services/merge');

/** Reads a video URL from different Agnes response shapes.
 * @param {Record<string, any>} data Agnes response
 * @returns {string} remote video URL
 */
function extractVideoUrl(data) {
  return data.video_url || data.video || data.url || data.output?.url || data.result?.url || '';
}

/** Creates video generation, polling and merging routes.
 * @param {{agnesClient: {post: Function, queryVideo: Function, download: Function}, outputsDir: string, mergeImpl?: Function}} dependencies route dependencies
 * @returns {import('express').Router} router
 */
function createVideoRouter({ agnesClient, outputsDir, mergeImpl = mergeVideos }) {
  const router = express.Router();

  router.post('/create-video', asyncHandler(async (req, res) => {
    const { prompt, imageUrl, width = 736, height = 1312, seed } = req.body || {};
    if (typeof prompt !== 'string' || !prompt.trim()) throw new HttpError(400, '缺少 prompt（应包含角色设定与剧情上下文）', 'VALIDATION_ERROR');
    if (typeof imageUrl !== 'string' || !/^https?:\/\//i.test(imageUrl)) throw new HttpError(400, 'imageUrl 必须是 Agnes 可访问的远程 HTTP(S) 地址', 'VALIDATION_ERROR');
    if (![736, 1312].includes(Number(width)) || ![736, 1312].includes(Number(height))) throw new HttpError(400, '视频尺寸仅支持 736×1312 或 1312×736', 'VALIDATION_ERROR');

    const payload = {
      model: 'agnes-video-v2.0',
      prompt: prompt.trim(),
      image: imageUrl,
      width: Number(width),
      height: Number(height),
      num_frames: 121,
      frame_rate: 24,
    };
    if (seed !== undefined) payload.seed = Number(seed);
    const data = await agnesClient.post('/v1/videos', payload, { retries: 3, retryDelayMs: 5000 });
    const videoId = data?.video_id || data?.id;
    if (!videoId) throw new HttpError(502, 'Agnes 未返回 video_id', 'EMPTY_AGNES_RESPONSE');
    res.json({ videoId });
  }));

  router.get('/query-video', asyncHandler(async (req, res) => {
    const videoId = String(req.query.videoId || '').trim();
    if (!videoId) throw new HttpError(400, '缺少 videoId', 'VALIDATION_ERROR');
    const data = await agnesClient.queryVideo(videoId);
    const status = data.status || data.state || data.progress || 'processing';
    const remoteVideoUrl = extractVideoUrl(data);
    let videoUrl = remoteVideoUrl;
    if (status === 'completed' && remoteVideoUrl) videoUrl = await agnesClient.download(remoteVideoUrl, '.mp4');
    res.json({ status, videoUrl, remoteVideoUrl });
  }));

  router.post('/merge-videos', asyncHandler(async (req, res) => {
    const { videoPaths } = req.body || {};
    if (!Array.isArray(videoPaths) || videoPaths.length < 2) throw new HttpError(400, 'videoPaths 至少需要两个视频路径', 'VALIDATION_ERROR');
    if (videoPaths.length > 100) throw new HttpError(400, '一次最多合并 100 个片段', 'VALIDATION_ERROR');
    res.json({ mergedUrl: await mergeImpl(videoPaths, outputsDir) });
  }));

  return router;
}

module.exports = { createVideoRouter, extractVideoUrl };

