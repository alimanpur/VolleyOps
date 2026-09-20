import { http } from './http.js';

export const publicService = {
  tournament: () => http.get('/public/tournament'),
  overview: () => http.get('/public/overview'),
  fixtures: () => http.get('/public/fixtures'),
  results: () => http.get('/public/results'),
  standings: () => http.get('/public/standings'),
  teams: () => http.get('/public/teams'),
  team: (id) => http.get(`/public/teams/${id}`),
  players: () => http.get('/public/players'),
  player: (id) => http.get(`/public/players/${id}`),
  stats: (teamId) => http.get(`/public/stats${teamId ? `?teamId=${teamId}` : ''}`),
  awards: () => http.get('/public/awards'),
  match: (id) => http.get(`/public/matches/${id}`),
  search: (q) => http.get(`/public/search?q=${encodeURIComponent(q)}`),
  progress: () => http.get('/public/progress'),
};
