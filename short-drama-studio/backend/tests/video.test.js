const express = require('express');
const request = require('supertest');
const { createVideoRouter } = require('../routes/video');
const { errorHandler } = require('../middleware/errors');

/** Creates an isolated video API app.
 * @param {object} agnesClient mocked Agnes client
 * @param {Function} mergeImpl mocked merger
 * @returns {import('express').Express} app
 */
function makeApp(agnesClient, mergeImpl = jest.fn()) {
  const app = express();
  app.use(express.json());
  app.use('/api', createVideoRouter({ agnesClient, outputsDir: 'C:/outputs', mergeImpl }));
  app.use(errorHandler);
  return app;
}

test('POST /api/create-video keeps the full prompt and returns task id', async () => {
  const agnesClient = { post: jest.fn().mockResolvedValue({ video_id: 'video-123' }) };
  const prompt = '角色设定：林夏，短发红衣。剧情上下文：上一幕刚离开车站。保持外貌与服装一致。';
  const response = await request(makeApp(agnesClient)).post('/api/create-video').send({ prompt, imageUrl: 'https://cdn.example/frame.png', width: 736, height: 1312 });
  expect(response.status).toBe(200);
  expect(response.body.videoId).toBe('video-123');
  expect(agnesClient.post.mock.calls[0][1].prompt).toBe(prompt);
});

test('POST /api/merge-videos delegates ordered paths to merger', async () => {
  const mergeImpl = jest.fn().mockResolvedValue('/outputs/merged.mp4');
  const response = await request(makeApp({}, mergeImpl)).post('/api/merge-videos').send({ videoPaths: ['/outputs/1.mp4', '/outputs/2.mp4'] });
  expect(response.status).toBe(200);
  expect(response.body.mergedUrl).toBe('/outputs/merged.mp4');
  expect(mergeImpl.mock.calls[0][0]).toEqual(['/outputs/1.mp4', '/outputs/2.mp4']);
});

test('POST /api/create-video requires a public image URL', async () => {
  const response = await request(makeApp({ post: jest.fn() })).post('/api/create-video').send({ prompt: 'scene', imageUrl: '/outputs/frame.png' });
  expect(response.status).toBe(400);
});

