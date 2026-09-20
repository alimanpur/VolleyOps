import { Router } from 'express';
import { captainController } from '../controllers/captainController.js';
import { requireRole } from '../middleware/auth.js';

// Every captain route requires a CAPTAIN (or ADMIN) session; scope is enforced
// inside each controller against req.auth.team, never a client-supplied id.
export const captainRoutes = Router();

captainRoutes.use(requireRole('CAPTAIN', 'ADMIN'));

captainRoutes.get('/dashboard', captainController.dashboard);
captainRoutes.get('/roster', captainController.roster);
captainRoutes.get('/fixtures', captainController.fixtures);
captainRoutes.get('/standings', captainController.standings);
captainRoutes.get('/stats', captainController.stats);
captainRoutes.get('/matches/:matchId', captainController.matchDetail);
captainRoutes.get('/notifications', captainController.notifications);
captainRoutes.post('/notifications/:id/read', captainController.markNotificationRead);
