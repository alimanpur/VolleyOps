import { Link } from 'react-router-dom';
import { StaffAccessCard, PageHeader } from '../../components/ui/primitives.jsx';
import { Icon } from '../../components/ui/icons.jsx';

/*
 * The staff entry point — a discoverable hub that routes into the EXISTING auth
 * flows (admin login, captain code, scorer code). It does not authenticate
 * anything itself and exposes no credentials; it simply explains each role and
 * how to enter. Reached from the top-nav "Staff" action and the footer.
 */
const ROLES = [
  {
    to: '/admin/login',
    icon: Icon.Admin,
    role: 'Admin',
    purpose: 'Tournament control center — fixtures, rosters, scoring assignments, results.',
    entry: 'Username + password',
    points: ['Full tournament management', 'Assign scorers and courts', 'Publish the bracket'],
  },
  {
    to: '/captain/access',
    icon: Icon.Captain,
    role: 'Captain',
    purpose: 'Your team portal — roster, fixtures, standings and stats for your side.',
    entry: 'Team access code',
    points: ['See your roster and standby', 'Track your next match', 'Follow your results'],
  },
  {
    to: '/scorer/access',
    icon: Icon.Scorer,
    role: 'Scorer',
    purpose: 'The live scoring console — record every rally, fast, on a phone.',
    entry: 'Scorer access code',
    points: ['One-tap point scoring', 'Works offline mid-match', 'Undo and substitutions'],
  },
];

export default function StaffAccessHub() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        kicker="Staff access"
        title="Choose your tournament role"
        lead="Access is by role. Admins sign in with a username and password; captains and scorers redeem the one-time code shared by the tournament admin."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {ROLES.map((r) => (
          <StaffAccessCard key={r.role} {...r} />
        ))}
      </div>

      <p className="text-sm text-muted">
        Not staff?{' '}
        <Link to="/" className="font-medium text-green underline-offset-2 hover:underline">
          Back to the tournament
        </Link>
        .
      </p>
    </div>
  );
}
