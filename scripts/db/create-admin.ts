#!/usr/bin/env tsx
/**
 * Securely creates or promotes an initial Viewora super_admin account.
 * NEVER hard-codes passwords. Reads ADMIN_EMAIL, ADMIN_NAME, and ADMIN_PASSWORD
 * from environment variables (or prompts interactively on TTY).
 *
 * Usage:
 *   ADMIN_EMAIL=founder@yourdomain.com ADMIN_NAME="Founder Name" ADMIN_PASSWORD="..." npm run db:create-admin
 */
import readline from 'readline';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { validateAdminBootstrapInput } from '../../src/lib/admin/bootstrap-validation';

const prisma = new PrismaClient();

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL must be configured before creating an administrator.');
    process.exit(1);
  }

  const rawEmail = process.env.ADMIN_EMAIL || (await prompt('Administrator email: '));
  const rawFullName =
    process.env.ADMIN_NAME || (await prompt('Administrator full name: ')) || 'Viewora Administrator';
  const password =
    process.env.ADMIN_PASSWORD || (await prompt('Administrator password (min 12 chars, mixed classes): '));

  const validation = validateAdminBootstrapInput({
    email: rawEmail,
    fullName: rawFullName,
    password,
  });

  if (!validation.ok) {
    for (const msg of validation.errors) {
      console.error(`ERROR: ${msg}`);
    }
    process.exit(1);
  }

  const { email, fullName } = validation;
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email } });
    if (existing) {
      const promoted = await tx.user.update({
        where: { id: existing.id },
        data: {
          fullName,
          name: fullName,
          role: 'super_admin',
          accountStatus: 'active',
          passwordHash,
          emailVerified: existing.emailVerified ?? new Date(),
          onboardingCompleted: true,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: promoted.id,
          actorEmail: promoted.email,
          action: 'admin.bootstrap.promoted',
          targetType: 'user',
          targetId: promoted.id,
          diff: { previousRole: existing.role, role: 'super_admin' },
        },
      });
      return promoted;
    }

    const created = await tx.user.create({
      data: {
        email,
        fullName,
        name: fullName,
        role: 'super_admin',
        accountStatus: 'active',
        segment: 'agency',
        passwordHash,
        emailVerified: new Date(),
        onboardingCompleted: true,
        preferences: {
          create: {
            professionalTitle: 'Platform Administrator',
            organization: 'Viewora Operations',
            workspaceName: 'Operations HQ',
          },
        },
      },
    });

    const workspace = await tx.workspace.create({
      data: {
        ownerId: created.id,
        name: 'Operations HQ',
        slug: `ws-admin-${created.id.slice(0, 8)}`,
        segment: 'agency',
        isDefault: true,
      },
    });

    await tx.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: created.id,
        memberRole: 'owner',
      },
    });

    const agencyPlan =
      (await tx.plan.findUnique({ where: { code: 'agency' } })) ??
      (await tx.plan.findUnique({ where: { code: 'free' } }));
    if (agencyPlan) {
      await tx.subscription.create({
        data: {
          userId: created.id,
          workspaceId: workspace.id,
          planId: agencyPlan.id,
          billingInterval: 'annual',
          status: 'active',
          paymentProvider: 'disabled',
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: created.id,
        actorEmail: created.email,
        action: 'admin.bootstrap.created',
        targetType: 'user',
        targetId: created.id,
        diff: { role: 'super_admin' },
      },
    });

    return created;
  });

  console.log(`[Viewora Admin Bootstrap] Super administrator ready: ${user.email} (id: ${user.id})`);
}

main()
  .catch((err) => {
    console.error('[Viewora Admin Bootstrap] Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
