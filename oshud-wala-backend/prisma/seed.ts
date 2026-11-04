import { PrismaClient, RoleName } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seed...');

    const roles = Object.values(RoleName);
    
    for (const roleName of roles) {
        await prisma.role.upsert({
            where: { name: roleName },
            update: {},
            create: { name: roleName, description: `${roleName} role` },
        });
    }
    console.log('✅ Roles seeded');

    const superAdminRole = await prisma.role.findUnique({ where: { name: RoleName.SUPER_ADMIN } });
    
    if (superAdminRole) {
        const adminEmail = 'admin@oshudwala.com';
        const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
        
        if (!existingAdmin) {
            const passwordHash = await bcrypt.hash('Admin@123', 10);
            await prisma.user.create({
                data: {
                    email: adminEmail,
                    phone: '0000000000',
                    passwordHash,
                    fullName: 'Super Admin',
                    roleId: superAdminRole.id,
                }
            });
            console.log('✅ Default Super Admin created (admin@oshudwala.com / Admin@123)');
        }
    }

    console.log('🌱 Seeding complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });