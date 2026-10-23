const express = require('express');
const { AssetType } = require('../models');
const { id, error, text, plain, audit, wrap, mainAdmin } = require('../services/common');
const router = express.Router();
const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
router.get('/', wrap(async (req, res) => res.json((await AssetType.find(req.user.role === 'MAIN_ADMIN' && req.query.includeInactive === 'true' ? {} : { active: true }).sort({ name: 1 }).lean()).map(plain))));
router.post('/', mainAdmin, wrap(async (req, res) => {
  const code = text(req.body.code, 'code', 12).toUpperCase();
  if (!/^[A-Z0-9_-]{2,12}$/.test(code)) error(400, 'Invalid asset code.');
  const defaultPriority = req.body.defaultPriority || 'MEDIUM';
  if (!priorities.includes(defaultPriority)) error(400, 'Invalid priority.');
  const asset = await AssetType.create({ id: id(), name: text(req.body.name, 'name', 60), code, defaultPriority });
  await audit(req.user.id, 'CREATE_ASSET_TYPE', 'AssetType', asset.id);
  res.status(201).json(plain(asset));
}));
router.patch('/:id', mainAdmin, wrap(async (req, res) => {
  const asset = await AssetType.findOne({ id: req.params.id });
  if (!asset) error(404, 'Asset type not found.');
  if (req.body.name !== undefined) asset.name = text(req.body.name, 'name', 60);
  if (req.body.defaultPriority !== undefined) { if (!priorities.includes(req.body.defaultPriority)) error(400, 'Invalid priority.'); asset.defaultPriority = req.body.defaultPriority; }
  if (req.body.active !== undefined) asset.active = Boolean(req.body.active);
  await asset.save(); await audit(req.user.id, 'UPDATE_ASSET_TYPE', 'AssetType', asset.id);
  res.json(plain(asset));
}));
module.exports = router;
