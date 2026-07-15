const express = require('express');
const { asyncHandler, HttpError } = require('../middleware/errors');

/** Adds creative constraints to a user's story idea.
 * @param {string} userContent original idea
 * @returns {string} enriched prompt
 */
function enrichPrompt(userContent) {
  return `${userContent}\n\n【创作要求】加入意料之外的转折、鲜明角色反差和不落俗套的冲突；每集结尾设置明确悬念，保持人物设定前后一致。`;
}

/** Creates text generation routes.
 * @param {{agnesClient: {post: Function}}} dependencies route dependencies
 * @returns {import('express').Router} router
 */
function createTextRouter({ agnesClient }) {
  const router = express.Router();
  router.post('/generate-text', asyncHandler(async (req, res) => {
    const { systemPrompt, userContent, temperature = 0.9 } = req.body || {};
    if (typeof systemPrompt !== 'string' || !systemPrompt.trim()) throw new HttpError(400, '缺少 systemPrompt', 'VALIDATION_ERROR');
    if (typeof userContent !== 'string' || !userContent.trim()) throw new HttpError(400, '缺少 userContent', 'VALIDATION_ERROR');
    const numericTemperature = Number(temperature);
    if (!Number.isFinite(numericTemperature) || numericTemperature < 0 || numericTemperature > 2) throw new HttpError(400, 'temperature 必须在 0 到 2 之间', 'VALIDATION_ERROR');

    const data = await agnesClient.post('/v1/chat/completions', {
      model: 'agnes-2.0-flash',
      messages: [
        { role: 'system', content: systemPrompt.trim() },
        { role: 'user', content: enrichPrompt(userContent.trim()) },
      ],
      temperature: numericTemperature,
      max_tokens: 4096,
    });
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new HttpError(502, 'Agnes 未返回文字内容', 'EMPTY_AGNES_RESPONSE');
    res.json({ text });
  }));
  return router;
}

module.exports = { createTextRouter, enrichPrompt };

