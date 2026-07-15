const fs = require('fs-extra');
const path = require('path');
const { createAgnesClient } = require('../services/agnes');

const testOutputs = path.join(__dirname, '.tmp-outputs');

beforeEach(async () => fs.ensureDir(testOutputs));
afterEach(async () => fs.remove(testOutputs));

test('Agnes client posts JSON with the configured bearer key', async () => {
  const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'ok' }) });
  const client = createAgnesClient({ getApiKey: () => 'sk-1234567890123456', outputsDir: testOutputs, fetchImpl });
  await expect(client.post('/v1/test', { prompt: 'hello' }, { retries: 0 })).resolves.toEqual({ id: 'ok' });
  expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer sk-1234567890123456');
});

test('Agnes client reports a missing key before sending a request', async () => {
  const fetchImpl = jest.fn();
  const client = createAgnesClient({ getApiKey: () => '', outputsDir: testOutputs, fetchImpl });
  await expect(client.post('/v1/test', {}, { retries: 0 })).rejects.toMatchObject({ status: 401, code: 'API_KEY_REQUIRED' });
  expect(fetchImpl).not.toHaveBeenCalled();
});

test('Agnes client downloads a remote asset to outputs', async () => {
  const fetchImpl = jest.fn().mockResolvedValue({ ok: true, buffer: async () => Buffer.from('image-bytes') });
  const client = createAgnesClient({ getApiKey: () => 'sk-1234567890123456', outputsDir: testOutputs, fetchImpl });
  const localUrl = await client.download('https://cdn.example/image.png', '.png');
  expect(localUrl).toMatch(/^\/outputs\/.+\.png$/);
  expect(await fs.pathExists(path.join(testOutputs, path.basename(localUrl)))).toBe(true);
});

