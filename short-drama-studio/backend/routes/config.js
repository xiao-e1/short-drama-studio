const express = require('express');
const { asyncHandler } = require('../middleware/errors');

/** Creates API key configuration routes.
 * @param {{configStore: import('../config/store').ConfigStore}} dependencies route dependencies
 * @returns {import('express').Router} router
 */
function createConfigRouter({ configStore }) {
  const router = express.Router();
  router.get('/status', (req, res) => res.json({ configured: configStore.hasKey() }));
  router.post('/key', asyncHandler(async (req, res) => {
    const { key, persist = false } = req.body || {};
    await configStore.setKey(key, Boolean(persist));
    res.json({ ok: true, configured: true, persisted: Boolean(persist) });
  }));
  return router;
}

module.exports = { createConfigRouter };

