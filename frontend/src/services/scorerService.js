import { http } from './http.js';

export const scorerService = {
  assignments: () => http.get('/scorer/assignments'),
  match: (id) => http.get(`/scorer/matches/${id}`),
  setLineups: (id, lineups) => http.post(`/scorer/matches/${id}/lineups`, lineups),
  start: (id) => http.post(`/scorer/matches/${id}/start`),
  rally: (id, event) => http.post(`/scorer/matches/${id}/rally`, event),
  undo: (id) => http.post(`/scorer/matches/${id}/undo`),
  patchRally: (id, patch) => http.patch(`/scorer/matches/${id}/rally`, patch),
  substitute: (id, sub) => http.post(`/scorer/matches/${id}/substitute`, sub),
};
