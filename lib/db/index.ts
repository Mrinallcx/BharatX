import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '@/lib/db/schema';
import { serverEnv } from '@/env/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(serverEnv.DATABASE_URL);

export const maindb = drizzle(sql, { schema });

export const db = maindb;
