import 'dotenv/config';

/** Read an env var with a fallback; throws in production if a required one is missing. */
function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return fallback;
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  mongoUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/volleyops'),
  sessionSecret: required('SESSION_SECRET'),
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 12),
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  admin: {
    username: required('ADMIN_USERNAME'),
    password: required('ADMIN_PASSWORD'),
  },
  trustProxy: process.env.TRUST_PROXY === 'true',
  get isProd() {
    return this.nodeEnv === 'production';
  },
};
