jest.setTimeout(10000);

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_EXPIRE = '7d';
process.env.FRONTEND_URL = 'http://localhost:3000';

// Supabase test credentials (non-functional, for module loading only)
process.env.SUPABASE_URL = 'https://test-project.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

global.captchas = new Map();
