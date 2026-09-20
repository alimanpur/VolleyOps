import { Router } from 'express';
import { authRoutes } from './authRoutes.js';
import { publicRoutes } from './publicRoutes.js';
import { captainRoutes } from './captainRoutes.js';
import { scorerRoutes } from './scorerRoutes.js';
import { adminRoutes } from './adminRoutes.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => res.json({ ok: true, service: 'volleyops-api' }));

apiRouter.use('/auth', authRoutes);
apiRouter.use('/public', publicRoutes);
apiRouter.use('/captain', captainRoutes);
apiRouter.use('/scorer', scorerRoutes);
apiRouter.use('/admin', adminRoutes);
