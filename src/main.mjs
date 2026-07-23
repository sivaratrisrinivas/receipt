import { neon } from "@neondatabase/serverless";
import { createSupportWorkflow } from "./support-workflow.mjs";
import { createVerifier } from "./verifier.mjs";
import { createNeonLedgerReader, createNeonLedgerWriter, createNeonReceiptStore } from "./neon-repositories.mjs";
import { createSupportWorkflowServer } from "./http-server.mjs";
import { createVerificationScheduler } from "./scheduler.mjs";
import { createRefundService } from "./refund-service.mjs";
import { createRefundServiceServer } from "./refund-server.mjs";
import { createVerifierServer, createVerificationTriggerClient } from "./verifier-server.mjs";
import { createTrustedReferenceClient } from "./trusted-reference-client.mjs";

const databaseUrl = process.env.VERIFIER_DATABASE_URL;
if (!databaseUrl) throw new Error("VERIFIER_DATABASE_URL must use the restricted verifier role and be set in ignored local environment configuration.");
const ledgerDatabaseUrl = process.env.LEDGER_DATABASE_URL;
if (!ledgerDatabaseUrl) throw new Error("LEDGER_DATABASE_URL must use the Payment Ledger writer role and be set in ignored local environment configuration.");
const sql = neon(databaseUrl);
const client = { query: async (statement, values) => ({ rows: await sql.query(statement, values) }) };
const ledgerSql = neon(ledgerDatabaseUrl);
const ledgerClient = { query: async (statement, values) => ({ rows: await ledgerSql.query(statement, values) }) };
const receipt = createNeonReceiptStore(client);
const verifier = createVerifier({ clock: () => new Date(), receipt, ledger: createNeonLedgerReader(client) });
const workflow = createSupportWorkflow({ trustedReferences: receipt, verifier });
const scheduler = createVerificationScheduler({ clock: () => new Date(), receipt, ledger: createNeonLedgerReader(client) });
setInterval(() => scheduler.runDueWork().catch(() => {}), 1_000).unref();
const server = createSupportWorkflowServer(workflow);
const supportPort = Number(process.env.PORT ?? 3000);
server.listen(supportPort, "127.0.0.1");
const verifierPort = Number(process.env.VERIFIER_PORT ?? 3002);
createVerifierServer(verifier).listen(verifierPort, "127.0.0.1");
const refundService = createRefundService({
  ledger: createNeonLedgerWriter(ledgerClient),
  trustedReferences: createTrustedReferenceClient({ baseUrl: `http://127.0.0.1:${supportPort}` }),
  verificationTrigger: createVerificationTriggerClient({ baseUrl: `http://127.0.0.1:${verifierPort}` }),
});
createRefundServiceServer(refundService).listen(Number(process.env.REFUND_SERVICE_PORT ?? 3001), "127.0.0.1");
