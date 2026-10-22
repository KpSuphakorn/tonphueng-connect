import { stdin, stdout } from "node:process";
import { StringDecoder } from "node:string_decoder";
import { createServiceClient } from "../src/lib/supabase";

try {
  process.loadEnvFile(".env.local");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

function promptHidden(label: string): Promise<string> {
  if (!stdin.isTTY || !stdin.setRawMode) {
    return Promise.reject(new Error("Run this command in a terminal so credentials can be hidden."));
  }
  return new Promise((resolve, reject) => {
    stdout.write(label);
    let value = "";
    const decoder = new StringDecoder("utf8");
    const finish = (error?: Error) => {
      if (!error) value += decoder.end();
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: Buffer) => {
      for (const character of decoder.write(chunk)) {
        if (character === "\u0003") return finish(new Error("Cancelled."));
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u007f" || character === "\b") {
          value = Array.from(value).slice(0, -1).join("");
        } else if (character >= " " && Array.from(value).length < 8_192) {
          value += character;
        }
      }
    };
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Usage: npm run bootstrap-admin -- owner@example.com");
  }

  const password = await promptHidden("Choose an initial password (12+ characters, input hidden): ");
  if (Array.from(password).length < 12) throw new Error("Use an initial password with at least 12 characters.");
  const client = createServiceClient();

  const { data: existingAdmin, error: adminLookupError } = await client
    .from("app_accounts")
    .select("id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  if (adminLookupError) throw new Error("Could not check existing Admin accounts.");
  if (existingAdmin) throw new Error("An Admin account already exists. Use the Admin invitation flow for additional Admins.");

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1_000 });
    if (error) throw new Error("Could not check existing Auth users.");
    if (data.users.some((user) => user.email?.toLowerCase() === email)) {
      throw new Error("An account already uses this email. No changes were made.");
    }
    if (data.users.length < 1_000) break;
  }

  const { data: created, error: createError } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) throw new Error("Could not create the initial Admin login.");

  const { error: accountError } = await client.from("app_accounts").insert({
    role: "admin",
    status: "pending",
    auth_user_id: created.user.id,
    line_subject: null,
  });
  if (accountError) {
    const { error: rollbackError } = await client.auth.admin.deleteUser(created.user.id);
    if (rollbackError) {
      throw new Error("Admin setup failed and automatic cleanup failed. Remove the new Auth user in Supabase before retrying.");
    }
    throw new Error("Admin setup failed. The temporary Auth user was removed; check the database migration before retrying.");
  }

  console.log("Initial Admin account created. On first sign-in, the owner must provide both this password and a verified LINE account to bind.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Admin setup failed.");
  process.exitCode = 1;
});
