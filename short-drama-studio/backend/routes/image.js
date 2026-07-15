const express = require('express');
const { asyncHandler, HttpError } = require('../middleware/errors');

const VALID_RATIOS = new Set(['9:16', '16:9', '1:1']);

/** Creates image generation routes.
 * @param {{agnesClient: {post: Function, download: Function}}} dependencies route dependencies
 * @returns {import('express').Router} router
 */
function createImageRouter({ agnesClient }) {
  const router = express.Router();
  router.post('/generate-image', asyncHandler(async (req, res) => {
    const { prompt, ratio = '9:16' } = req.body || {};
    if (typeof prompt !== 'string' || !prompt.trim()) throw new HttpError(400, '缺少 prompt', 'VALIDATION_ERROR');
    if (!VALID_RATIOS.has(ratio)) throw new HttpError(400, 'ratio 仅支持 9:16、16:9 或 1:1', 'VALIDATION_ERROR');

    const data = await agnesClient.post('/v1/images/generations', {
      model: 'agnes-image-2.1-flash',
      prompt: prompt.trim(),
      size: '1K',
      ratio,
      extra_body: { response_format: 'url' },
    }, { retries: 1 });
    const remoteUrl = data?.data?.[0]?.url;
    if (!remoteUrl) throw new HttpError(502, 'Agnes 未返回图片地址', 'EMPTY_AGNES_RESPONSE');
    const localUrl = await agnesClient.download(remoteUrl, '.png');
    res.json({ localUrl, remoteUrl });
  }));
  return router;
}

module.exports = { createImageRouter };

