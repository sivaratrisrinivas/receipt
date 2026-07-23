// These adapters require a real Neon/Postgres client supplied by the runtime.
// They intentionally provide no in-memory or SQLite fallback.

export function createNeonLedgerReader(ledgerClient) {
  return {
    async readRefundState(refundReference) {
      const result = await ledgerClient.query(
        "SELECT state FROM ledger.refunds WHERE refund_reference = $1",
        [refundReference],
      );
      return result.rows[0]?.state ?? "MISSING";
    },
  };
}

export function createNeonReceiptStore(receiptClient) {
  return {
    async create({ messageReference, refundReference }) {
      await receiptClient.query(
        `INSERT INTO receipt.trusted_refund_references (message_reference, refund_reference)
         VALUES ($1, $2)`,
        [messageReference, refundReference],
      );
    },

    async findByMessageReference(messageReference) {
      const result = await receiptClient.query(
        `SELECT refund_reference FROM receipt.trusted_refund_references
         WHERE message_reference = $1`,
        [messageReference],
      );
      return result.rows[0]?.refund_reference ?? null;
    },
    async findClaimByMessageReference(messageReference) {
      const result = await receiptClient.query(
        `SELECT id, claim_type AS type, message_reference AS "messageReference",
                completion_deadline_at AS "completionDeadlineAt", verdict,
                last_checked_at AS "lastCheckedAt"
           FROM receipt.claims
          WHERE message_reference = $1`,
        [messageReference],
      );
      return result.rows[0] ?? null;
    },

    async findDueSchedule(now) {
      const result = await receiptClient.query(
        `SELECT schedule.id AS "scheduleId", schedule.kind, claim.id AS "claimId",
                claim.refund_reference AS "refundReference"
           FROM receipt.verification_schedule AS schedule
           JOIN receipt.claims AS claim ON claim.id = schedule.claim_id
          WHERE schedule.completed_at IS NULL AND schedule.due_at <= $1
          ORDER BY schedule.due_at`,
        [now.toISOString()],
      );
      return result.rows;
    },

    async recordScheduledCheck({ scheduleId, claimId, checkedAt, refundState, trigger }) {
      await receiptClient.query(
        `INSERT INTO receipt.authoritative_checks (claim_id, checked_at, refund_state, trigger)
         VALUES ($1, $2, $3, $4)`,
        [claimId, checkedAt, refundState, trigger],
      );
      await receiptClient.query(
        `UPDATE receipt.verification_schedule SET completed_at = $1 WHERE id = $2`,
        [checkedAt, scheduleId],
      );
    },

    async storeClaimWithInitialCheckAndSchedule({
      contractVersion,
      claim,
      authoritativeCheck,
      schedule,
    }) {
      await receiptClient.query("BEGIN");
      try {
        await receiptClient.query(
          `INSERT INTO receipt.contract_versions
             (version, claim_type, completion_deadline_ms)
           VALUES ($1, $2, $3)
           ON CONFLICT (version) DO NOTHING`,
          [
            contractVersion.version,
            contractVersion.claimType,
            contractVersion.completionDeadlineMs,
          ],
        );
        await receiptClient.query(
          `INSERT INTO receipt.claims
             (id, claim_type, message_reference, refund_reference, contract_version,
              recognized_at, completion_deadline_at, verdict, last_checked_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            claim.id,
            claim.type,
            claim.messageReference,
            claim.refundReference,
            claim.contractVersion,
            claim.recognizedAt,
            claim.completionDeadlineAt,
            claim.verdict,
            claim.lastCheckedAt,
          ],
        );
        await receiptClient.query(
          `INSERT INTO receipt.authoritative_checks
             (claim_id, checked_at, refund_state, trigger)
           VALUES ($1, $2, $3, $4)`,
          [
            authoritativeCheck.claimId,
            authoritativeCheck.checkedAt,
            authoritativeCheck.refundState,
            authoritativeCheck.trigger,
          ],
        );
        for (const item of schedule) {
          await receiptClient.query(
            `INSERT INTO receipt.verification_schedule (claim_id, kind, due_at, completed_at)
             VALUES ($1, $2, $3, $4)`,
            [item.claimId, item.kind, item.dueAt, item.completedAt ?? null],
          );
        }
        await receiptClient.query("COMMIT");
      } catch (error) {
        await receiptClient.query("ROLLBACK");
        throw error;
      }
    },
  };
}
