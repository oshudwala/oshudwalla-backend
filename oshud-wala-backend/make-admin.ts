import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function makeAdmin() {
    try {
        console.log("Checking SUPER_ADMIN role...");
        // 1. Role table e SUPER_ADMIN na thakle toiri korbe
        let superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
        if (!superAdminRole) {
            superAdminRole = await prisma.role.create({ data: { name: 'SUPER_ADMIN', description: 'System Administrator' } });
            console.log("Created SUPER_ADMIN role.");
        }

        // 2. Database er first user ke khuje ber korbe
        const user = await prisma.user.findFirst();
        
        if (!user) {
            console.log("❌ Kono user pawa jayni! Age Postman theke ekta user Register koro.");
            return;
        }

        // 3. Sei user ke SUPER_ADMIN baniye dibe
        await prisma.user.update({
            where: { id: user.id },
            data: { roleId: superAdminRole.id }
        });
        
        console.log(`✅ BOOM! User ${user.phone} is now a SUPER_ADMIN!`);
    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        await prisma.$disconnect();
    }
}

makeAdmin();