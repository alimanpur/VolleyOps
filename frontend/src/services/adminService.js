import { http } from './http.js';

export const adminService = {
  dashboard: () => http.get('/admin/dashboard'),

  getTournament: () => http.get('/admin/tournament'),
  saveTournament: (data) => http.put('/admin/tournament', data),
  publish: () => http.post('/admin/tournament/publish'),
  buildBracket: () => http.post('/admin/tournament/bracket'),
  setOpenScoring: (enabled) => http.post('/admin/tournament/open-scoring', { enabled }),

  progress: () => http.get('/admin/tournament/progress'),
  lockQualification: () => http.post('/admin/tournament/qualification/lock'),
  generateSemifinals: () => http.post('/admin/tournament/semifinals'),
  generateFinal: () => http.post('/admin/tournament/final'),
  completeTournament: () => http.post('/admin/tournament/complete'),
  setTiebreakOverride: (teamId, rank) => http.post('/admin/tournament/tiebreak', { teamId, rank }),

  teams: () => http.get('/admin/teams'),
  createTeam: (data) => http.post('/admin/teams', data),
  updateTeam: (id, data) => http.put(`/admin/teams/${id}`, data),
  deleteTeam: (id) => http.del(`/admin/teams/${id}`),
  teamRoster: (id) => http.get(`/admin/teams/${id}/roster`),
  setCaptain: (teamId, playerId) => http.post(`/admin/teams/${teamId}/captain`, { playerId }),

  createPlayer: (teamId, data) => http.post(`/admin/teams/${teamId}/players`, data),
  updatePlayer: (playerId, data) => http.put(`/admin/players/${playerId}`, data),
  deletePlayer: (playerId) => http.del(`/admin/players/${playerId}`),

  courts: () => http.get('/admin/courts'),
  createCourt: (data) => http.post('/admin/courts', data),
  deleteCourt: (id) => http.del(`/admin/courts/${id}`),

  matches: () => http.get('/admin/matches'),
  match: (id) => http.get(`/admin/matches/${id}`),
  updateMatch: (id, data) => http.put(`/admin/matches/${id}`, data),
  assignScorer: (id, scorerId) => http.post(`/admin/matches/${id}/scorer`, { scorerId }),
  reopenMatch: (id) => http.post(`/admin/matches/${id}/reopen`),
  resetMatch: (id) => http.post(`/admin/matches/${id}/reset`),
  lockMatch: (id) => http.post(`/admin/matches/${id}/lock`),
  cancelMatch: (id) => http.post(`/admin/matches/${id}/cancel`),

  standings: () => http.get('/admin/standings'),
  stats: () => http.get('/admin/stats'),

  awards: () => http.get('/admin/awards'),
  upsertAward: (data) => http.post('/admin/awards', data),
  updateAward: (id, data) => http.put(`/admin/awards/${id}`, data),

  notifications: () => http.get('/admin/notifications'),
  createNotification: (data) => http.post('/admin/notifications', data),

  access: () => http.get('/admin/access'),
  createAccess: (data) => http.post('/admin/access', data),
  regenerateAccess: (id) => http.post(`/admin/access/${id}/regenerate`),
  revokeAccess: (id) => http.post(`/admin/access/${id}/revoke`),

  audit: () => http.get('/admin/audit'),
};
