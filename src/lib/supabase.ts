import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith("replace_with_") || value.includes("your-project")) {
    throw new ConfigurationError(`Missing server configuration: ${name}`);
  }
  return value;
}

export function createAuthClient(): SupabaseClient {
  return createClient(required("SUPABASE_URL"), required("SUPABASE_PUBLISHABLE_KEY"), {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

export function createServiceClient(): SupabaseClient {
  return createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}
