import { neon } from "@neondatabase/serverless";
import { createSupportWorkflow } from "./support-workflow.mjs";
import { createVerifier } from "./verifier.mjs";
import { createNeonLedgerReader, createNeonReceiptStore } from "./neon-repositories.mjs";
import { createSupportWorkflowServer } from "./http-server.mjs";
import { createVerificationScheduler } from "./scheduler.mjs";

const databaseUrl = process.env.VERIFIER_DATABASE_URL;
if (!databaseUrl) throw new Error("VERIFIER_DATABASE_URL must use the restricted verifier role and be set in ignored local environment configuration.");
const sql = neon(databaseUrl);
const client = { query: async (statement, values) => ({ rows: await sql.query(statement, values) }) };
const receipt = createNeonReceiptStore(client);
const verifier = createVerifier({ clock: () => new Date(), receipt, ledger: createNeonLedgerReader(client) });
const workflow = createSupportWorkflow({ trustedReferences: receipt, verifier });
const scheduler = createVerificationScheduler({ clock: () => new Date(), receipt, ledger: createNeonLedgerReader(client) });
setInterval(() => scheduler.runDueWork().catch(() => {}), 1_000).unref();
const server = createSupportWorkflowServer(workflow);
server.listen(Number(process.env.PORT ?? 3000), "127.0.0.1");
