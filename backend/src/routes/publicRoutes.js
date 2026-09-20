import { Router } from 'express';
import { publicController } from '../controllers/publicController.js';

// All public routes are unauthenticated by design (spec §7A, §43).
export const publicRoutes = Router();

publicRoutes.get('/tournament', publicController.tournament);
publicRoutes.get('/overview', publicController.overview);
publicRoutes.get('/fixtures', publicController.fixtures);
publicRoutes.get('/results', publicController.results);
publicRoutes.get('/standings', publicController.standings);
publicRoutes.get('/teams', publicController.teams);
publicRoutes.get('/teams/:teamId', publicController.teamDetail);
publicRoutes.get('/players', publicController.players);
publicRoutes.get('/players/:playerId', publicController.playerDetail);
publicRoutes.get('/stats', publicController.stats);
publicRoutes.get('/awards', publicController.awards);
publicRoutes.get('/matches/:matchId', publicController.matchDetail);
publicRoutes.get('/search', publicController.search);
publicRoutes.get('/progress', publicController.tournamentProgress);
