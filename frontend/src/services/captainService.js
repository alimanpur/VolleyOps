import { http } from './http.js';

export const captainService = {
  dashboard: () => http.get('/captain/dashboard'),
  roster: () => http.get('/captain/roster'),
  fixtures: () => http.get('/captain/fixtures'),
  standings: () => http.get('/captain/standings'),
  stats: () => http.get('/captain/stats'),
  match: (id) => http.get(`/captain/matches/${id}`),
  notifications: () => http.get('/captain/notifications'),
  markRead: (id) => http.post(`/captain/notifications/${id}/read`),
};
