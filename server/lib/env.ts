import "dotenv/config";

function read(name: string): string {
  return process.env[name] ?? "";
}

export const env = {
  appId: read("APP_ID"),
  appSecret: read("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: read("DATABASE_URL"),
};
