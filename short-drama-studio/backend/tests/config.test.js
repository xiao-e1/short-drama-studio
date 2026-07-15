const express = require('express');
const request = require('supertest');
const { createConfigRouter } = require('../routes/config');
const { errorHandler } = require('../middleware/errors');

/** Creates an isolated configuration API app.
 * @param {object} configStore mocked key store
 * @returns {import('express').Express} app
 */
function makeApp(configStore) {
  const app = express();
  app.use(express.json());
  app.use('/api/config', createConfigRouter({ configStore }));
  app.use(errorHandler);
  return app;
}

test('GET /api/config/status does not expose the key', async () => {
  const response = await request(makeApp({ hasKey: () => true })).get('/api/config/status');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ configured: true });
});

test('POST /api/config/key delegates persistence choice to the store', async () => {
  const configStore = { hasKey: () => false, setKey: jest.fn().mockResolvedValue() };
  const response = await request(makeApp(configStore)).post('/api/config/key').send({ key: 'sk-1234567890123456', persist: true });
  expect(response.status).toBe(200);
  expect(configStore.setKey).toHaveBeenCalledWith('sk-1234567890123456', true);
  expect(response.body.persisted).toBe(true);
});

