import { PrismaClient, RoleName } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding roles...');
    for (const roleName of Object.values(RoleName)) {
        await prisma.role.upsert({
            where: { name: roleName },
            update: {},
            create: { name: roleName, description: `${roleName} role` },
        });
    }
    console.log(`Roles ready: ${Object.values(RoleName).join(', ')}`);

    const email = process.env.SUPER_ADMIN_EMAIL;
    const phone = process.env.SUPER_ADMIN_PHONE;
    const password = process.env.SUPER_ADMIN_PASSWORD;
    const fullName = process.env.SUPER_ADMIN_FULL_NAME || 'Super Admin';

    if (!email || !phone || !password) {
        console.log('SUPER_ADMIN_EMAIL / SUPER_ADMIN_PHONE / SUPER_ADMIN_PASSWORD not set. Skipping Super Admin creation.');
        return;
    }
    if (password.length < 12) {
        throw new Error('SUPER_ADMIN_PASSWORD must be at least 12 characters.');
    }

    const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { phone }] } });
    if (existing) {
        console.log('A user with this email/phone already exists. Super Admin not created (no changes made).');
        return;
    }

    const role = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.SUPER_ADMIN } });
    await prisma.user.create({
        data: {
            email,
            phone,
            fullName,
            passwordHash: await bcrypt.hash(password, 12),
            roleId: role.id,
            emailVerifiedAt: new Date(),
            phoneVerifiedAt: new Date(),
        },
    });
    console.log(`Super Admin created: ${email}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
