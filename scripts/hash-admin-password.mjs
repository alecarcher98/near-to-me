// Prints an ADMIN_USERS entry with a scrypt-hashed password.
// Usage: npm run admin:hash -- Sam        (then type the password and press Enter)
//        echo "password" | npm run admin:hash -- Sam
// Must match the format verified in lib/admin-auth.ts.
import { randomBytes, scrypt } from "node:crypto";
import { createInterface } from "node:readline";

const name = process.argv[2];
if (!name || name.includes(":") || name.includes(",")) {
  console.error("Give the admin's name (no colons or commas): npm run admin:hash -- Sam");
  process.exit(1);
}

async function readPassword() {
  const lines = createInterface({ input: process.stdin, terminal: false });
  if (process.stdin.isTTY) process.stderr.write("Password (min 12 characters): ");
  for await (const line of lines) return line;
  return "";
}

const password = (await readPassword()).trim();
if (password.length < 12) {
  console.error("\nUse a password of at least 12 characters.");
  process.exit(1);
}

const cost = 16384;
const salt = randomBytes(16);
scrypt(password.normalize("NFKC"), salt, 32, { N: cost, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, hash) => {
  if (error) throw error;
  console.log(`${name}:scrypt:${cost}:8:1:${salt.toString("base64url")}:${hash.toString("base64url")}`);
});
