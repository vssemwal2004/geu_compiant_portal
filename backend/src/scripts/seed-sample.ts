/**
 * Optional demo data: the campus tree, asset types and the routing examples from the
 * architecture PDF (§9), plus the Sub-Admin accounts those rules need.
 * Sub-Admins are created as INVITED with placeholder @example.com emails — edit them in the
 * portal (or delete this data) before real use. Run after seed:admin. Skips if a campus exists.
 */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppModule } from '../app.module';
import type { AuthUser } from '../common/auth-user';
import { LocationType, Role, TicketPriority, UserStatus } from '../common/enums';
import { AssetTypesService } from '../asset-types/asset-types.service';
import { Location } from '../locations/location.schema';
import { LocationsService } from '../locations/locations.service';
import { RoutingService } from '../routing/routing.service';
import { User } from '../users/user.schema';
import { UsersService } from '../users/users.service';

const TREE: Record<string, Record<string, string[]>> = {
  'GR Block': { 'Floor 1': ['Room 104'], 'Floor 2': ['Lab 205', 'Lab 206'], 'Floor 3': ['Lab 301'] },
  'GEHU Block': { 'Floor 1': ['Lab 110'], 'Floor 2': ['Lab 214'] },
  'Hostel A': { 'Floor 3': ['Room 312'] },
  Library: { 'Ground Floor': ['Reading Hall'] },
  'Admin Block': { 'Floor 1': ['Corridor'] },
};

const ASSETS: { name: string; code: string; defaultPriority: TicketPriority }[] = [
  { name: 'Computer', code: 'COMP', defaultPriority: TicketPriority.MEDIUM },
  { name: 'Projector', code: 'PROJ', defaultPriority: TicketPriority.MEDIUM },
  { name: 'Furniture', code: 'FURN', defaultPriority: TicketPriority.LOW },
  { name: 'Electrical', code: 'ELEC', defaultPriority: TicketPriority.HIGH },
  { name: 'Networking', code: 'NET', defaultPriority: TicketPriority.MEDIUM },
  { name: 'Other', code: 'OTH', defaultPriority: TicketPriority.LOW },
];

const SUB_ADMINS = [
  { key: 'grit', name: 'GR IT Admin', employeeId: 'DEMO-S-101' },
  { key: 'grtech', name: 'GR Technical Admin', employeeId: 'DEMO-S-102' },
  { key: 'gehumaint', name: 'GEHU Maintenance Admin', employeeId: 'DEMO-S-103' },
  { key: 'hostel', name: 'Hostel Maintenance Admin', employeeId: 'DEMO-S-104' },
];

// [location path, asset code, sub-admin key] — first four rows are the PDF's examples.
const RULES: [string, string, string][] = [
  ['GR Block/Floor 2/Lab 205', 'COMP', 'grit'],
  ['GR Block', 'PROJ', 'grtech'],
  ['GEHU Block', 'FURN', 'gehumaint'],
  ['Hostel A', 'ELEC', 'hostel'],
  ['GR Block', 'COMP', 'grit'],
  ['GR Block', 'NET', 'grit'],
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const locationModel = app.get<Model<Location>>(getModelToken(Location.name));
    const userModel = app.get<Model<User>>(getModelToken(User.name));
    if (await locationModel.exists({ type: LocationType.CAMPUS })) {
      console.log('A campus already exists — sample data not added.');
      return;
    }
    const admin = await userModel.findOne({ role: Role.MAIN_ADMIN, status: UserStatus.ACTIVE }).lean();
    if (!admin) throw new Error('Run "npm run seed:admin" first.');
    const actor: AuthUser = { id: admin._id, role: Role.MAIN_ADMIN, name: admin.name, email: admin.email, allowedLocationIds: [], sessionId: new Types.ObjectId() };

    const locations = app.get(LocationsService);
    const assetTypes = app.get(AssetTypesService);
    const routing = app.get(RoutingService);
    const users = app.get(UsersService);

    const ids = new Map<string, Types.ObjectId>();
    const campus = await locations.create({ type: LocationType.CAMPUS, name: 'Main Campus' });
    for (const [building, floors] of Object.entries(TREE)) {
      const b = await locations.create({ parentId: campus._id, type: LocationType.BUILDING, name: building });
      ids.set(building, b._id);
      for (const [floor, labs] of Object.entries(floors)) {
        const f = await locations.create({ parentId: b._id, type: LocationType.FLOOR, name: floor });
        ids.set(`${building}/${floor}`, f._id);
        for (const lab of labs) {
          const l = await locations.create({ parentId: f._id, type: LocationType.LAB, name: lab });
          ids.set(`${building}/${floor}/${lab}`, l._id);
        }
      }
    }

    const assetIds = new Map<string, Types.ObjectId>();
    for (const a of ASSETS) assetIds.set(a.code, (await assetTypes.create(a))._id);

    const subAdminIds = new Map<string, Types.ObjectId>();
    console.log('\nSub-Admin invite links (share each with the right person, or edit the emails first):');
    for (const s of SUB_ADMINS) {
      const { user, invite } = await users.create(actor, { name: s.name, email: `${s.key}@example.com`, employeeId: s.employeeId, role: Role.SUB_ADMIN });
      subAdminIds.set(s.key, user.id);
      console.log(`  ${s.name}: ${invite.url}`);
    }

    // Invited Sub-Admins are not ACTIVE yet, so routing skips them until they set a password.
    for (const [path, code, key] of RULES)
      await routing.create({ locationId: ids.get(path)!, assetTypeId: assetIds.get(code)!, subAdminId: subAdminIds.get(key)! }, admin._id);

    console.log(`\nSample data added: ${ids.size + 1} locations, ${ASSETS.length} asset types, ${RULES.length} routing rules.`);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
