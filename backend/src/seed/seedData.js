/**
 * Development seed definition for the IPS Academy Volleyball Tournament.
 *
 * This is clearly-labelled DEVELOPMENT data used to exercise every workflow. It
 * seeds the five real teams and a full, eligible roster per team so rosters read
 * as complete, plus courts, a scorer, and captains. Match results are NOT seeded
 * — the tournament starts unplayed so scoring/bracket progression can be tested
 * live. Admins reconfigure real data through the UI; nothing here is hardcoded
 * into the frontend.
 */

export const TOURNAMENT = {
  name: 'IPS Academy Volleyball Tournament',
  subtitle: 'Inter-Year Championship',
  venue: 'IPS Academy, Indore',
  startDate: new Date('2026-09-21T09:30:00+05:30'),
  endDate: new Date('2026-09-22T21:00:00+05:30'),
  startTimeNote: 'Matches begin after 3:00 PM',
  timezone: 'Asia/Kolkata',
  rules: { bestOf: 3, pointsPerSet: 25, pointsFinalSet: 15, winBy: 2 },
  status: 'PUBLISHED',
  isActive: true,
};

// code -> { name, year, colorToken }
export const TEAMS = [
  { code: '1ST_CSE', name: 'LOCAL SPRINTERS', shortName: 'Sprinters', year: 1, colorToken: 'green' },
  { code: '1ST_AIML', name: 'ONE HIT WONDERS', shortName: 'OHW', year: 1, colorToken: 'amber' },
  { code: '2ND_YEAR', name: 'NET DESTROYERS', shortName: 'NetDest', year: 2, colorToken: 'graphite' },
  { code: '3RD_CSE_1', name: 'HIGH IMPACT', shortName: 'HighImp', year: 3, colorToken: 'deepGreen' },
  { code: '3RD_CSE_2', name: 'BLOCK PARTY', shortName: 'BlockParty', year: 3, colorToken: 'scoreRed' },
];

const POSITIONS = ['SETTER', 'OUTSIDE', 'MIDDLE', 'OPPOSITE', 'OUTSIDE', 'MIDDLE', 'LIBERO'];

// Generate 6 active + 1 standby for a team, all matching the team year.
export function rosterFor(team) {
  const first = [
    'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh',
    'Krishna', 'Ishaan', 'Kabir', 'Ansh', 'Dhruv', 'Rudra', 'Aryan',
  ];
  const players = [];
  for (let i = 0; i < 7; i += 1) {
    const status = i < 6 ? 'ACTIVE' : 'STANDBY';
    players.push({
      name: `${first[(team.year * 3 + i) % first.length]} ${team.shortName.replace(/\s/g, '')}${i + 1}`,
      jerseyNumber: i + 1,
      year: team.year,
      position: POSITIONS[i],
      status,
      isCaptain: i === 0, // first active player captains
    });
  }
  return players;
}

export const COURTS = [
  { name: 'Court 1', location: 'Main Arena' },
  { name: 'Court 2', location: 'Practice Hall' },
];
