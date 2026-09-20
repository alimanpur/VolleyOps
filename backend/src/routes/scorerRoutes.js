import { Router } from 'express';
import { scorerController } from '../controllers/scorerController.js';
import { requireRole } from '../middleware/auth.js';

// SCORER (or ADMIN) session required; per-match assignment is checked in the
// controller so scorer A can never touch scorer B's match.
export const scorerRoutes = Router();

scorerRoutes.use(requireRole('SCORER', 'ADMIN'));

scorerRoutes.get('/assignments', scorerController.assignments);
scorerRoutes.get('/matches/:matchId', scorerController.match);
scorerRoutes.post('/matches/:matchId/lineups', scorerController.setLineups);
scorerRoutes.post('/matches/:matchId/start', scorerController.start);
scorerRoutes.post('/matches/:matchId/rally', scorerController.rally);
scorerRoutes.post('/matches/:matchId/undo', scorerController.undo);
scorerRoutes.patch('/matches/:matchId/rally', scorerController.patchRally);
scorerRoutes.post('/matches/:matchId/substitute', scorerController.substitute);
