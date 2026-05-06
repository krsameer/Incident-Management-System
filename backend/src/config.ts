import { z } from 'zod';

const configSchema = z.object({
  PORT: z.coerce.number().default(3001),
  POSTGRES_URL: z.string().default('postgres://ims:ims@localhost:5432/ims'),
  MONGODB_URL: z.string().default('mongodb://localhost:27017'),
  MONGODB_DB: z.string().default('ims'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  CORS_ORIGIN: z.string().default('http://localhost:5173')
});

export const config = configSchema.parse(process.env);
