import { PrismaClient } from '@prisma/client';
import { ApiError } from '../../utils/apiError';
const prisma = new PrismaClient();

export const onboardDoctorToPharmacy = async (pharmacyId: string, doctorData: any) => {
    return await prisma.$transaction(async (tx) => {
        
        // 1. Check if a User already exists (Scenario A)
        const searchConditions: any[] = [];
        if (doctorData.phone) searchConditions.push({ phone: doctorData.phone });
        if (doctorData.email) searchConditions.push({ email: doctorData.email });

        let user = await tx.user.findFirst({
            where: { OR: searchConditions },
            include: { role: true }
        });

        let doctor = null;

        if (user) {
            // Scenario A: User ache. Check kori tar Doctor profile ache kina.
            doctor = await tx.doctor.findUnique({ where: { userId: user.id } });
            
            if (!doctor) {
                // Safety: never change the role of a non-patient account (e.g. SUPER_ADMIN, PHARMACY, RIDER)
                if (user.role.name !== 'PATIENT') {
                    throw new ApiError(409, `This phone/email already belongs to a ${user.role.name} account and cannot be converted to a Doctor.`);
                }
                // User ache kintu Doctor noy, tai take Doctor role dewa hocche
                let doctorRole = await tx.role.findUnique({ where: { name: 'DOCTOR' } });
                if (!doctorRole) {
                    doctorRole = await tx.role.create({ data: { name: 'DOCTOR', description: 'Medical Doctor' } });
                }
                await tx.user.update({ where: { id: user.id }, data: { roleId: doctorRole.id } });

                doctor = await tx.doctor.create({
                    data: {
                        userId: user.id,
                        fullName: doctorData.fullName,
                        phone: user.phone,
                        email: user.email,
                        registrationNumber: doctorData.registrationNumber,
                        experienceYears: doctorData.experienceYears || 0,
                        bio: doctorData.bio
                    }
                });
            }
        } else {
            // Scenario B: User nei. Check kori Unregistered Doctor profile aage theke ache kina.
            doctor = await tx.doctor.findFirst({
                where: { OR: searchConditions }
            });

            if (!doctor) {
                // Notun Unregistered Doctor profile toiri kora hocche (without userId)
                doctor = await tx.doctor.create({
                    data: {
                        fullName: doctorData.fullName,
                        phone: doctorData.phone || null,
                        email: doctorData.email || null,
                        registrationNumber: doctorData.registrationNumber,
                        experienceYears: doctorData.experienceYears || 0,
                        bio: doctorData.bio
                    }
                });
            }
        }

        // 2. Link Specialization (if not already linked)
        const existingSpec = await tx.doctorSpecialization.findFirst({
            where: { doctorId: doctor.id, specializationId: doctorData.specializationId }
        });
        
        if (!existingSpec) {
            await tx.doctorSpecialization.create({
                data: { doctorId: doctor.id, specializationId: doctorData.specializationId }
            });
        }

        // 3. Link Doctor to the Specific Pharmacy (Many-to-Many logic)
        const existingPharmacyLink = await tx.pharmacyDoctor.findFirst({
            where: { pharmacyId, doctorId: doctor.id }
        });

        if (!existingPharmacyLink) {
            await tx.pharmacyDoctor.create({
                data: {
                    pharmacyId,
                    doctorId: doctor.id,
                    consultationFeePaise: doctorData.consultationFeePaise || 0,
                    isActive: true
                }
            });
        } else {
            // Update fee jodi aage theke thake
            await tx.pharmacyDoctor.update({
                where: { id: existingPharmacyLink.id },
                data: { consultationFeePaise: doctorData.consultationFeePaise || existingPharmacyLink.consultationFeePaise }
            });
        }

        // 4. Return formatted response
        return await tx.doctor.findUnique({
            where: { id: doctor.id },
            include: {
                user: { select: { id: true, status: true } }, // Registration status bojhar jonno
                specializations: { include: { specialization: true } },
                pharmacies: { where: { pharmacyId }, select: { consultationFeePaise: true, isActive: true } }
            }
        });
    });
};

export const getPharmacyDoctors = async (pharmacyId: string) => {
    return await prisma.pharmacyDoctor.findMany({
        where: { pharmacyId, isActive: true },
        include: {
            doctor: {
                include: {
                    user: { select: { id: true, status: true } },
                    specializations: { include: { specialization: true } }
                }
            }
        }
    });
};