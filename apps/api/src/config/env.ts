import "dotenv/config";
import { z } from "zod";
const schema = z.object({ API_PORT:z.coerce.number().default(4000), CLIENT_URL:z.string().default("http://localhost:3000"), SUPABASE_URL:z.string().url(), SUPABASE_SERVICE_ROLE_KEY:z.string().min(1) });
export const env = schema.parse(process.env);
