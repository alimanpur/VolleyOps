import { Router } from 'express';
import { adminController } from '../controllers/adminController.js';
import { requireRole } from '../middleware/auth.js';

// Admin-only. Kept separate from public navigation entirely (spec §52).
export const adminRoutes = Router();

adminRoutes.use(requireRole('ADMIN'));

adminRoutes.get('/dashboard', adminController.dashboard);

// Tournament
adminRoutes.get('/tournament', adminController.getTournament);
adminRoutes.put('/tournament', adminController.upsertTournament);
adminRoutes.post('/tournament/publish', adminController.publish);
adminRoutes.post('/tournament/bracket', adminController.buildBracket);
adminRoutes.post('/tournament/open-scoring', adminController.setOpenScoring);
adminRoutes.get('/tournament/progress', adminController.getProgress);
adminRoutes.post('/tournament/qualification/lock', adminController.lockQualification);
adminRoutes.post('/tournament/semifinals', adminController.generateSemifinals);
adminRoutes.post('/tournament/final', adminController.generateFinal);
adminRoutes.post('/tournament/complete', adminController.completeTournament);
adminRoutes.post('/tournament/tiebreak', adminController.setTiebreakOverride);

// Teams
adminRoutes.get('/teams', adminController.listTeams);
adminRoutes.post('/teams', adminController.createTeam);
adminRoutes.put('/teams/:teamId', adminController.updateTeam);
adminRoutes.delete('/teams/:teamId', adminController.deleteTeam);
adminRoutes.get('/teams/:teamId/roster', adminController.teamRoster);
adminRoutes.post('/teams/:teamId/captain', adminController.setCaptain);

// Players
adminRoutes.post('/teams/:teamId/players', adminController.createPlayer);
adminRoutes.put('/players/:playerId', adminController.updatePlayer);
adminRoutes.delete('/players/:playerId', adminController.deletePlayer);

// Courts
adminRoutes.get('/courts', adminController.listCourts);
adminRoutes.post('/courts', adminController.createCourt);
adminRoutes.delete('/courts/:courtId', adminController.deleteCourt);

// Matches
adminRoutes.get('/matches', adminController.listMatches);
adminRoutes.get('/matches/:matchId', adminController.matchDetail);
adminRoutes.put('/matches/:matchId', adminController.updateMatch);
adminRoutes.post('/matches/:matchId/scorer', adminController.assignScorer);
adminRoutes.post('/matches/:matchId/reopen', adminController.reopenMatch);
adminRoutes.post('/matches/:matchId/reset', adminController.resetMatch);
adminRoutes.post('/matches/:matchId/lock', adminController.lockMatch);
adminRoutes.post('/matches/:matchId/cancel', adminController.cancelMatch);

// Standings & stats
adminRoutes.get('/standings', adminController.standings);
adminRoutes.get('/stats', adminController.stats);

// Awards
adminRoutes.get('/awards', adminController.listAwards);
adminRoutes.post('/awards', adminController.upsertAward);
adminRoutes.put('/awards/:awardId', adminController.updateAward);

// Notifications
adminRoutes.get('/notifications', adminController.listNotifications);
adminRoutes.post('/notifications', adminController.createNotification);
adminRoutes.post('/notifications/:id/read', adminController.markNotificationRead);

// Access (captains & scorers)
adminRoutes.get('/access', adminController.listAccess);
adminRoutes.post('/access', adminController.createAccess);
adminRoutes.post('/access/:userId/regenerate', adminController.regenerateAccess);
adminRoutes.post('/access/:userId/revoke', adminController.revokeAccess);

// Audit
adminRoutes.get('/audit', adminController.audit);
