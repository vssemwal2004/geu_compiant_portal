const express = require('express');
const { User, Location, AssetType, RoutingRule } = require('../models');
const { plain, wrap } = require('../services/common');
const router = express.Router();
router.get('/', wrap(async (req, res) => {
  const [users, locations, assetTypes, rules] = await Promise.all([
    User.find({ status: 'ACTIVE' }).lean(), Location.find({ active: true }).lean(),
    AssetType.find({ active: true }).lean(), RoutingRule.find({ active: true }).lean(),
  ]);
  const visibleUsers = req.user.role === 'MAIN_ADMIN'
    ? users.map(plain)
    : users.map(user => ({ id: user.id, name: user.name, role: user.role, title: user.title }));
  res.json({ users: visibleUsers, locations: locations.map(plain), assetTypes: assetTypes.map(plain),
    routingRules: rules.filter(r => users.some(u => u.id === r.subAdminId)).map(plain) });
}));
module.exports = router;
