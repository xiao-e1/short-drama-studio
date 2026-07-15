const express = require('express');
const request = require('supertest');
const { createTextRouter } = require('../routes/text');
const { errorHandler } = require('../middleware/errors');

/** Creates an isolated text API app.
 * @param {object} agnesClient mocked Agnes client
 * @returns {import('express').Express} app
 */
function makeApp(agnesClient) {
  const app = express();
  app.use(express.json());
  app.use('/api', createTextRouter({ agnesClient }));
  app.use(errorHandler);
  return app;
}

test('POST /api/generate-text returns generated text', async () => {
  const agnesClient = { post: jest.fn().mockResolvedValue({ choices: [{ message: { content: '第一集剧情' } }] }) };
  const response = await request(makeApp(agnesClient)).post('/api/generate-text').send({ systemPrompt: '你是编剧', userContent: '校园悬疑剧' });
  expect(response.status).toBe(200);
  expect(response.body.text).toBe('第一集剧情');
  expect(agnesClient.post).toHaveBeenCalledTimes(1);
});

test('POST /api/generate-text validates required fields', async () => {
  const response = await request(makeApp({ post: jest.fn() })).post('/api/generate-text').send({ userContent: 'idea' });
  expect(response.status).toBe(400);
  expect(response.body.code).toBe('VALIDATION_ERROR');
});

