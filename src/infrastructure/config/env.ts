import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().default("postgresql://localhost:5432/test"),
  DIRECT_URL: z.string().optional(),
  GITHUB_TOKEN: z.string().default(""),
  DEEPSEEK_API_KEY: z.string().default(""),
  DEEPSEEK_BASE_URL: z.string().default("https://api.deepseek.com"),
  QSTASH_TOKEN: z.string().default(""),
  QSTASH_CURRENT_SIGNING_KEY: z.string().default(""),
  QSTASH_NEXT_SIGNING_KEY: z.string().default(""),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten());
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}

export const env = loadEnv();
