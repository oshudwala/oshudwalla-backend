import { RoleName } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/apiError';

type Actor = { id: string; role: RoleName };

const doctorInclude = {
    user: { select: { id: true, status: true } },
    specializations: { include: { specialization: true } },
    pharmacies: {
        where: { isActive: true },
        select: {
            id: true,
            pharmacyId: true,
            consultationFeePaise: true,
            isActive: true,
            pharmacy: { select: { id: true, name: true, city: true } },
        },
    },
};

export const onboardDoctorToPharmacy = async (pharmacyId: string, doctorData: any) => {
    return await prisma.$transaction(async (tx) => {
        const searchConditions: any[] = [];
        if (doctorData.phone) searchConditions.push({ phone: doctorData.phone });
        if (doctorData.email) searchConditions.push({ email: doctorData.email });

        const user = await tx.user.findFirst({
            where: { OR: searchConditions },
            include: { role: true },
        });

        let doctor = null;

        if (user) {
            doctor = await tx.doctor.findUnique({ where: { userId: user.id } });
            if (!doctor) {
                if (user.role.name !== 'PATIENT') {
                    throw new ApiError(409, `This phone/email already belongs to a ${user.role.name} account and cannot be converted to a Doctor.`);
                }
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
                        bio: doctorData.bio,
                    },
                });
            }
        } else {
            doctor = await tx.doctor.findFirst({ where: { OR: searchConditions } });
            if (!doctor) {
                doctor = await tx.doctor.create({
                    data: {
                        fullName: doctorData.fullName,
                        phone: doctorData.phone || null,
                        email: doctorData.email || null,
                        registrationNumber: doctorData.registrationNumber,
                        experienceYears: doctorData.experienceYears || 0,
                        bio: doctorData.bio,
                    },
                });
            }
        }

        const existingSpec = await tx.doctorSpecialization.findFirst({
            where: { doctorId: doctor.id, specializationId: doctorData.specializationId },
        });
        if (!existingSpec) {
            await tx.doctorSpecialization.create({
                data: { doctorId: doctor.id, specializationId: doctorData.specializationId },
            });
        }

        const existingPharmacyLink = await tx.pharmacyDoctor.findFirst({
            where: { pharmacyId, doctorId: doctor.id },
        });
        if (!existingPharmacyLink) {
            await tx.pharmacyDoctor.create({
                data: {
                    pharmacyId,
                    doctorId: doctor.id,
                    consultationFeePaise: doctorData.consultationFeePaise || 0,
                    isActive: true,
                },
            });
        } else {
            await tx.pharmacyDoctor.update({
                where: { id: existingPharmacyLink.id },
                data: { consultationFeePaise: doctorData.consultationFeePaise || existingPharmacyLink.consultationFeePaise },
            });
        }

        return await tx.doctor.findUnique({
            where: { id: doctor.id },
            include: {
                user: { select: { id: true, status: true } },
                specializations: { include: { specialization: true } },
                pharmacies: { where: { pharmacyId }, select: { consultationFeePaise: true, isActive: true } },
            },
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
                    specializations: { include: { specialization: true } },
                },
            },
        },
    });
};

// ---------------- Step 4: Global Doctor Profile & PharmacyDoctor Assignment ----------------

export const findDoctorById = (id: string) =>
    prisma.doctor.findUnique({ where: { id }, include: doctorInclude });

export const findPharmacyById = (id: string) =>
    prisma.pharmacy.findUnique({ where: { id } });

export const findActiveOwnerLink = (userId: string, pharmacyId: string) =>
    prisma.pharmacyStaff.findFirst({
        where: { userId, pharmacyId, staffRole: 'OWNER', isActive: true },
    });

export const countSpecializations = (ids: string[]) =>
    prisma.specialization.count({ where: { id: { in: ids } } });

export const listGlobalDoctors = (q?: string, specializationId?: string) => {
    const where: any = {};
    if (q) {
        where.OR = [
            { fullName: { contains: q, mode: 'insensitive' } },
            { registrationNumber: { contains: q, mode: 'insensitive' } },
        ];
    }
    if (specializationId) {
        where.specializations = { some: { specializationId } };
    }
    return prisma.doctor.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: doctorInclude,
    });
};

export const createGlobalDoctorWithAudit = (data: any, specializationIds: string[], actor: Actor) =>
    prisma.$transaction(
        async (tx) => {
            const doctor = await tx.doctor.create({
                data: {
                    fullName: data.fullName,
                    phone: data.phone ?? null,
                    email: data.email ?? null,
                    registrationNumber: data.registrationNumber,
                    qualifications: data.qualifications ?? null,
                    experienceYears: data.experienceYears ?? null,
                    bio: data.bio ?? null,
                    languages: data.languages ?? [],
                    isVerified: data.isVerified ?? false,
                    isFeatured: data.isFeatured ?? false,
                    specializations: {
                        create: specializationIds.map((specializationId) => ({ specializationId })),
                    },
                },
                include: doctorInclude,
            });

            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'DOCTOR_CREATED',
                    entityType: 'Doctor',
                    entityId: doctor.id,
                    after: doctor as any,
                },
            });

            return doctor;
        },
        { maxWait: 10000, timeout: 30000 }
    );

export const updateGlobalDoctorWithAudit = (id: string, before: any, data: any, specializationIds: string[] | undefined, actor: Actor) =>
    prisma.$transaction(
        async (tx) => {
            if (specializationIds !== undefined) {
                await tx.doctorSpecialization.deleteMany({ where: { doctorId: id } });
                await tx.doctorSpecialization.createMany({
                    data: specializationIds.map((specializationId) => ({ doctorId: id, specializationId })),
                });
            }

            const updated = await tx.doctor.update({
                where: { id },
                data,
                include: doctorInclude,
            });

            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'DOCTOR_UPDATED',
                    entityType: 'Doctor',
                    entityId: id,
                    before: before as any,
                    after: updated as any,
                },
            });

            return updated;
        },
        { maxWait: 10000, timeout: 30000 }
    );

export const upsertPharmacyDoctorWithAudit = (pharmacyId: string, doctorId: string, consultationFeePaise: number, actor: Actor) =>
    prisma.$transaction(
        async (tx) => {
            const existing = await tx.pharmacyDoctor.findUnique({
                where: { pharmacyId_doctorId: { pharmacyId, doctorId } },
            });

            const assignment = existing
                ? await tx.pharmacyDoctor.update({
                      where: { id: existing.id },
                      data: { consultationFeePaise, isActive: true },
                      include: {
                          doctor: { select: { id: true, fullName: true, registrationNumber: true } },
                          pharmacy: { select: { id: true, name: true } },
                      },
                  })
                : await tx.pharmacyDoctor.create({
                      data: { pharmacyId, doctorId, consultationFeePaise, isActive: true },
                      include: {
                          doctor: { select: { id: true, fullName: true, registrationNumber: true } },
                          pharmacy: { select: { id: true, name: true } },
                      },
                  });

            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'DOCTOR_ASSIGNED_TO_PHARMACY',
                    entityType: 'PharmacyDoctor',
                    entityId: assignment.id,
                    before: existing ? (existing as any) : undefined,
                    after: assignment as any,
                },
            });

            return assignment;
        },
        { maxWait: 10000, timeout: 30000 }
    );

export const findAssignmentById = (id: string) =>
    prisma.pharmacyDoctor.findUnique({ where: { id } });

export const updateAssignmentStatusWithAudit = (assignment: any, isActive: boolean, actor: Actor) =>
    prisma.$transaction(
        async (tx) => {
            const updated = await tx.pharmacyDoctor.update({
                where: { id: assignment.id },
                data: { isActive },
            });
            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'DOCTOR_ASSIGNMENT_STATUS_UPDATED',
                    entityType: 'PharmacyDoctor',
                    entityId: assignment.id,
                    before: { isActive: assignment.isActive } as any,
                    after: { isActive: updated.isActive } as any,
                },
            });
            return updated;
        },
        { maxWait: 10000, timeout: 30000 }
    );
