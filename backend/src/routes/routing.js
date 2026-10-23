const express = require('express');
const { Location, AssetType, RoutingRule, User } = require('../models');
const { id, error, plain, routeFor, ancestry, audit, wrap, mainAdmin } = require('../services/common');
const router = express.Router();
router.get('/preview', wrap(async (req, res) => {
  const rule = await routeFor(req.query.locationId, req.query.assetTypeId);
  res.json(rule ? { assigneeId: rule.subAdminId, ruleId: rule.id, ruleLocationId: rule.locationId } : { assigneeId: null });
}));
router.get('/rules', mainAdmin, wrap(async (_req, res) => res.json((await RoutingRule.find().lean()).map(plain))));
async function checkRule(locationId, assetTypeId, subAdminId) {
  if (!await Location.exists({ id: locationId, active: true }) || !await AssetType.exists({ id: assetTypeId, active: true })) error(400, 'Choose an active location and asset type.');
  const user = await User.findOne({ id: subAdminId, role: 'SUB_ADMIN', status: 'ACTIVE' }).lean();
  if (!user) error(400, 'Choose an active Sub-Admin.');
  if (user.scopeLocationIds?.length && !(await ancestry(locationId)).some(x => user.scopeLocationIds.includes(x))) error(400, 'The Sub-Admin is outside this location scope.');
}
router.post('/rules', mainAdmin, wrap(async (req, res) => {
  const { locationId, assetTypeId, subAdminId } = req.body;
  await checkRule(locationId, assetTypeId, subAdminId);
  const rule = await RoutingRule.create({ id: id(), locationId, assetTypeId, subAdminId, createdBy: req.user.id });
  await audit(req.user.id, 'CREATE_ROUTING_RULE', 'RoutingRule', rule.id);
  res.status(201).json(plain(rule));
}));
router.patch('/rules/:id', mainAdmin, wrap(async (req, res) => {
  const rule = await RoutingRule.findOne({ id: req.params.id });
  if (!rule) error(404, 'Routing rule not found.');
  if (req.body.subAdminId !== undefined) { await checkRule(rule.locationId, rule.assetTypeId, req.body.subAdminId); rule.subAdminId = req.body.subAdminId; }
  if (req.body.active !== undefined) rule.active = Boolean(req.body.active);
  await rule.save(); await audit(req.user.id, 'UPDATE_ROUTING_RULE', 'RoutingRule', rule.id);
  res.json(plain(rule));
}));
module.exports = router;
