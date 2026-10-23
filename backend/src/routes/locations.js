const express = require('express');
const { Location } = require('../models');
const { id, error, text, plain, ancestry, audit, wrap, mainAdmin } = require('../services/common');
const router = express.Router();
const parentType = { CAMPUS: null, BUILDING: 'CAMPUS', FLOOR: 'BUILDING', LAB: 'FLOOR' };
router.get('/', wrap(async (req, res) => res.json((await Location.find(req.user.role === 'MAIN_ADMIN' && req.query.includeInactive === 'true' ? {} : { active: true }).sort({ type: 1, name: 1 }).lean()).map(plain))));
router.get('/permitted', wrap(async (req, res) => {
  const locations = await Location.find({ active: true }).lean();
  if (req.user.role === 'MAIN_ADMIN') return res.json(locations.map(plain));
  if (req.user.role !== 'LAB_ASSISTANT') return res.json([]);
  const allowed = new Set(req.user.allowedLocationIds || []);
  const permitted = [];
  for (const location of locations) if ((await ancestry(location.id)).some(x => allowed.has(x))) permitted.push(plain(location));
  res.json(permitted);
}));
router.post('/', mainAdmin, wrap(async (req, res) => {
  const { type, parentId } = req.body;
  if (!(type in parentType)) error(400, 'Invalid location type.');
  const parent = parentId ? await Location.findOne({ id: parentId, active: true }).lean() : null;
  if (parentType[type] !== (parent?.type || null)) error(400, 'Invalid location hierarchy.');
  const location = await Location.create({ id: id(), parentId: parent?.id || null, type, name: text(req.body.name, 'name', 80), code: req.body.code || undefined });
  await audit(req.user.id, 'CREATE_LOCATION', 'Location', location.id);
  res.status(201).json(plain(location));
}));
router.patch('/:id', mainAdmin, wrap(async (req, res) => {
  const location = await Location.findOne({ id: req.params.id });
  if (!location) error(404, 'Location not found.');
  if (req.body.name !== undefined) location.name = text(req.body.name, 'name', 80);
  if (req.body.code !== undefined) location.code = String(req.body.code).slice(0, 20);
  if (req.body.active !== undefined) location.active = Boolean(req.body.active);
  await location.save(); await audit(req.user.id, 'UPDATE_LOCATION', 'Location', location.id);
  res.json(plain(location));
}));
module.exports = router;
