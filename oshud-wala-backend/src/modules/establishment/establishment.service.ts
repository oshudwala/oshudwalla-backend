import { ApiError } from '../../utils/apiError';
import * as establishmentRepo from './establishment.repository';
import { ServiceType } from '@prisma/client';

export const createEstablishmentByAdmin = async (adminId: string, payload: any) => {
    const { services, isPrimaryPharmacy, ...establishmentData } = payload;
    const uniqueServices = Array.from(new Set(services)) as ServiceType[]; // duplicate avoid korar jonno
    
    return await establishmentRepo.createEstablishment(adminId, establishmentData, uniqueServices, isPrimaryPharmacy);
};

export const makePrimary = async (establishmentId: string) => {
    return await establishmentRepo.setAsPrimaryPharmacy(establishmentId);
};

export const fetchAllActiveEstablishments = async () => {
    return await establishmentRepo.getAllEstablishments();
};