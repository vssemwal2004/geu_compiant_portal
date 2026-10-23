// Sample reference data for UI development only.
// Replaced by the backend admin APIs (users, locations, asset types, routing rules) in Phase 1.

import type { AssetType, Location, RoutingRule, User } from '../domain/types';

export const users: User[] = [
  { id: 'u-admin', name: 'Main Admin', email: 'admin@geu.ac.in', employeeId: 'GEU-A-001', role: 'MAIN_ADMIN', title: 'Administrator' },

  { id: 'u-sa-grit', name: 'GR IT Admin', email: 'grit@geu.ac.in', employeeId: 'GEU-S-101', role: 'SUB_ADMIN', title: 'Sub-Admin · IT' },
  { id: 'u-sa-grtech', name: 'GR Technical Admin', email: 'grtech@geu.ac.in', employeeId: 'GEU-S-102', role: 'SUB_ADMIN', title: 'Sub-Admin · Technical' },
  { id: 'u-sa-gehu-it', name: 'GEHU IT Admin', email: 'gehuit@geu.ac.in', employeeId: 'GEU-S-103', role: 'SUB_ADMIN', title: 'Sub-Admin · IT' },
  { id: 'u-sa-gehu-mt', name: 'GEHU Maintenance Admin', email: 'gehumaint@geu.ac.in', employeeId: 'GEU-S-104', role: 'SUB_ADMIN', title: 'Sub-Admin · Maintenance' },
  { id: 'u-sa-hostel', name: 'Hostel Maintenance Admin', email: 'hostelmaint@geu.ac.in', employeeId: 'GEU-S-105', role: 'SUB_ADMIN', title: 'Sub-Admin · Maintenance' },

  { id: 'u-la-negi', name: 'R. Negi', email: 'rnegi@geu.ac.in', employeeId: 'GEU-L-201', role: 'LAB_ASSISTANT', title: 'Lab Assistant', phone: '+91 90000 00001', allowedLocationIds: ['b-gr'] },
  { id: 'u-la-bisht', name: 'S. Bisht', email: 'sbisht@geu.ac.in', employeeId: 'GEU-L-202', role: 'LAB_ASSISTANT', title: 'Lab Assistant', phone: '+91 90000 00002', allowedLocationIds: ['b-gr'] },
  { id: 'u-la-rawat', name: 'A. Rawat', email: 'arawat@geu.ac.in', employeeId: 'GEU-L-203', role: 'LAB_ASSISTANT', title: 'Lab Assistant', phone: '+91 90000 00003', allowedLocationIds: ['b-hostel-a'] },
  { id: 'u-la-joshi', name: 'P. Joshi', email: 'pjoshi@geu.ac.in', employeeId: 'GEU-L-204', role: 'LAB_ASSISTANT', title: 'Lab Assistant', phone: '+91 90000 00004', allowedLocationIds: ['b-gehu'] },
  { id: 'u-la-thapa', name: 'K. Thapa', email: 'kthapa@geu.ac.in', employeeId: 'GEU-L-205', role: 'LAB_ASSISTANT', title: 'Lab Assistant', phone: '+91 90000 00005', allowedLocationIds: ['b-gehu'] },
  { id: 'u-la-rana', name: 'M. Rana', email: 'mrana@geu.ac.in', employeeId: 'GEU-L-206', role: 'LAB_ASSISTANT', title: 'Lab Assistant', phone: '+91 90000 00006', allowedLocationIds: ['b-lib'] },
  { id: 'u-la-panwar', name: 'D. Panwar', email: 'dpanwar@geu.ac.in', employeeId: 'GEU-L-207', role: 'LAB_ASSISTANT', title: 'Lab Assistant', phone: '+91 90000 00007', allowedLocationIds: ['b-admin'] },
];

// Campus → building → floor → lab/room
export const locations: Location[] = [
  { id: 'c-main', parentId: null, type: 'CAMPUS', name: 'Main Campus' },

  { id: 'b-gr', parentId: 'c-main', type: 'BUILDING', name: 'GR Block' },
  { id: 'f-gr-1', parentId: 'b-gr', type: 'FLOOR', name: 'Floor 1' },
  { id: 'l-gr-104', parentId: 'f-gr-1', type: 'LAB', name: 'Room 104' },
  { id: 'f-gr-2', parentId: 'b-gr', type: 'FLOOR', name: 'Floor 2' },
  { id: 'l-gr-205', parentId: 'f-gr-2', type: 'LAB', name: 'Lab 205' },
  { id: 'l-gr-206', parentId: 'f-gr-2', type: 'LAB', name: 'Lab 206' },
  { id: 'f-gr-3', parentId: 'b-gr', type: 'FLOOR', name: 'Floor 3' },
  { id: 'l-gr-301', parentId: 'f-gr-3', type: 'LAB', name: 'Lab 301' },

  { id: 'b-gehu', parentId: 'c-main', type: 'BUILDING', name: 'GEHU Block' },
  { id: 'f-gehu-1', parentId: 'b-gehu', type: 'FLOOR', name: 'Floor 1' },
  { id: 'l-gehu-110', parentId: 'f-gehu-1', type: 'LAB', name: 'Lab 110' },
  { id: 'f-gehu-2', parentId: 'b-gehu', type: 'FLOOR', name: 'Floor 2' },
  { id: 'l-gehu-214', parentId: 'f-gehu-2', type: 'LAB', name: 'Lab 214' },

  { id: 'b-hostel-a', parentId: 'c-main', type: 'BUILDING', name: 'Hostel A' },
  { id: 'f-ha-3', parentId: 'b-hostel-a', type: 'FLOOR', name: 'Floor 3' },
  { id: 'l-ha-312', parentId: 'f-ha-3', type: 'LAB', name: 'Room 312' },

  { id: 'b-lib', parentId: 'c-main', type: 'BUILDING', name: 'Library' },
  { id: 'f-lib-g', parentId: 'b-lib', type: 'FLOOR', name: 'Ground Floor' },
  { id: 'l-lib-read', parentId: 'f-lib-g', type: 'LAB', name: 'Reading Hall' },

  { id: 'b-admin', parentId: 'c-main', type: 'BUILDING', name: 'Admin Block' },
  { id: 'f-adm-1', parentId: 'b-admin', type: 'FLOOR', name: 'Floor 1' },
  { id: 'l-adm-corr', parentId: 'f-adm-1', type: 'LAB', name: 'Corridor' },
];

export const assetTypes: AssetType[] = [
  { id: 'at-computer', name: 'Computer', code: 'COMP', defaultPriority: 'MEDIUM' },
  { id: 'at-projector', name: 'Projector', code: 'PROJ', defaultPriority: 'MEDIUM' },
  { id: 'at-furniture', name: 'Furniture', code: 'FURN', defaultPriority: 'LOW' },
  { id: 'at-electrical', name: 'Electrical', code: 'ELEC', defaultPriority: 'HIGH' },
  { id: 'at-network', name: 'Networking', code: 'NET', defaultPriority: 'MEDIUM' },
  { id: 'at-other', name: 'Other', code: 'OTH', defaultPriority: 'LOW' },
];

// First four rows are the examples from the architecture PDF (§9).
export const routingRules: RoutingRule[] = [
  { id: 'r-1', locationId: 'l-gr-205', assetTypeId: 'at-computer', subAdminId: 'u-sa-grit', active: true },
  { id: 'r-2', locationId: 'b-gr', assetTypeId: 'at-projector', subAdminId: 'u-sa-grtech', active: true },
  { id: 'r-3', locationId: 'b-gehu', assetTypeId: 'at-furniture', subAdminId: 'u-sa-gehu-mt', active: true },
  { id: 'r-4', locationId: 'b-hostel-a', assetTypeId: 'at-electrical', subAdminId: 'u-sa-hostel', active: true },
  { id: 'r-5', locationId: 'b-gr', assetTypeId: 'at-computer', subAdminId: 'u-sa-grit', active: true },
  { id: 'r-6', locationId: 'b-gr', assetTypeId: 'at-network', subAdminId: 'u-sa-grit', active: true },
  { id: 'r-7', locationId: 'b-gehu', assetTypeId: 'at-computer', subAdminId: 'u-sa-gehu-it', active: true },
];
