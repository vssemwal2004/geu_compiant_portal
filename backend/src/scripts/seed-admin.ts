/**
 * Create the first Main Admin from SEED_ADMIN_* in .env.
 *   npm run seed:admin            create if missing
 *   npm run seed:admin -- --reset reset that admin's password to SEED_ADMIN_PASSWORD
 * After seeding, remove SEED_ADMIN_PASSWORD from .env.
 */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { AppConfig } from '../config/app-config.service';
import { Role, UserStatus } from '../common/enums';
import { hashPassword, passwordProblem } from '../auth/password';
import { User } from '../users/user.schema';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const config = app.get(AppConfig);
    const { name, email, employeeId, password } = config.seedAdmin;
    if (!email || !employeeId || !password) throw new Error('Set SEED_ADMIN_EMAIL, SEED_ADMIN_EMPLOYEE_ID and SEED_ADMIN_PASSWORD in .env first.');
    const problem = passwordProblem(password, config.passwordMinLength);
    if (problem) throw new Error(`SEED_ADMIN_PASSWORD rejected: ${problem}`);

    const users = app.get<Model<User>>(getModelToken(User.name));
    const existing = await users.findOne({ email: email.toLowerCase() });

    if (existing) {
      if (existing.role !== Role.MAIN_ADMIN) throw new Error(`${email} already exists as ${existing.role}; choose another email.`);
      if (!process.argv.includes('--reset')) {
        console.log(`Main Admin ${email} already exists. Use "npm run seed:admin -- --reset" to reset its password.`);
        return;
      }
      existing.passwordHash = await hashPassword(password);
      existing.status = UserStatus.ACTIVE;
      await existing.save();
      console.log(`Password reset for Main Admin ${email}.`);
      return;
    }

    await users.create({
      name: name || 'Main Admin',
      email,
      employeeId,
      role: Role.MAIN_ADMIN,
      title: 'Administrator',
      status: UserStatus.ACTIVE,
      passwordHash: await hashPassword(password),
    });
    console.log(`Main Admin created: ${email}. You can now sign in. Remove SEED_ADMIN_PASSWORD from .env.`);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
