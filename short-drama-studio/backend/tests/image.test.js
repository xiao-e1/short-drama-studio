const express = require('express');
const request = require('supertest');
const { createImageRouter } = require('../routes/image');
const { errorHandler } = require('../middleware/errors');

/** Creates an isolated image API app.
 * @param {object} agnesClient mocked Agnes client
 * @returns {import('express').Express} app
 */
function makeApp(agnesClient) {
  const app = express();
  app.use(express.json());
  app.use('/api', createImageRouter({ agnesClient }));
  app.use(errorHandler);
  return app;
}

test('POST /api/generate-image downloads and returns both URLs', async () => {
  const agnesClient = {
    post: jest.fn().mockResolvedValue({ data: [{ url: 'https://cdn.example/keyframe.png' }] }),
    download: jest.fn().mockResolvedValue('/outputs/keyframe.png'),
  };
  const response = await request(makeApp(agnesClient)).post('/api/generate-image').send({ prompt: '电影感校园走廊', ratio: '9:16' });
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ localUrl: '/outputs/keyframe.png', remoteUrl: 'https://cdn.example/keyframe.png' });
});

test('POST /api/generate-image rejects unsupported ratios', async () => {
  const response = await request(makeApp({ post: jest.fn() })).post('/api/generate-image').send({ prompt: 'scene', ratio: '4:3' });
  expect(response.status).toBe(400);
});

