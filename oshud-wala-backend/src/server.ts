import http from 'http';
import app from './app';
import './modules/notification/notification.worker';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const PORT = process.env.PORT || 5000;
export const prisma = new PrismaClient();

const server = http.createServer(app);

// Initialize Socket.IO
export const io = new Server(server, {
    cors: {
        origin: '*', 
        methods: ['GET', 'POST']
    }
});

io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
    });
});

const startServer = async () => {
    try {
        await prisma.$connect();
        console.log('📦 Connected to Supabase PostgreSQL');

        try {
            await prisma.$executeRawUnsafe('ALTER TABLE "promotions" ADD COLUMN IF NOT EXISTS "secondaryButtonText" TEXT;');
            await prisma.$executeRawUnsafe('ALTER TABLE "promotions" ADD COLUMN IF NOT EXISTS "secondaryButtonLink" TEXT;');
            console.log('✅ Promotions table schema verified');
        } catch (dbErr: any) {
            console.warn('Notice checking promotions columns:', dbErr?.message || dbErr);
        }

        server.listen(PORT, () => {
            console.log(`🚀 Oshud Wala Server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
    }
};

startServer();