// Bootstrap the first admin (there is no public sign-up and invites need an admin):
//   pnpm --filter api auth:create-admin --email you@example.com --name "Your Name" --password '...'
import "dotenv/config";
import { parseArgs } from "node:util";
import { auth } from "./auth.js";

const { values } = parseArgs({
  options: { email: { type: "string" }, name: { type: "string" }, password: { type: "string" } },
  allowPositionals: true, // pnpm may forward a literal "--"
});
if (!values.email || !values.name || !values.password) {
  console.error("Usage: auth:create-admin -- --email <email> --name <name> --password <password>");
  process.exit(1);
}

const { user } = await auth.api.createUser({
  body: { email: values.email, name: values.name, password: values.password, role: "admin" },
});
console.log(`Created admin ${user.email} (${user.id})`);
