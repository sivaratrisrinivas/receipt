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

export function createNeonLedgerWriter(ledgerClient) {
  return {
    async transitionRefund(refundReference, nextState) {
      if (!["PROCESSING", "SUCCEEDED", "REJECTED"].includes(nextState)) {
        throw new Error("A Refund State must be PROCESSING, SUCCEEDED, or REJECTED.");
      }
      const result = await ledgerClient.query(
        `WITH inserted AS (
           INSERT INTO ledger.refunds (refund_reference, state)
           SELECT $1, 'PROCESSING' WHERE $2 = 'PROCESSING'
           ON CONFLICT (refund_reference) DO NOTHING
           RETURNING state
         ), transitioned AS (
           UPDATE ledger.refunds SET state = $2
            WHERE refund_reference = $1
              AND NOT EXISTS (SELECT 1 FROM inserted)
              AND ((state = 'PROCESSING' AND $2 IN ('SUCCEEDED', 'REJECTED'))
                OR (state = 'SUCCEEDED' AND $2 = 'REJECTED')
                OR (state = 'REJECTED' AND $2 = 'PROCESSING'))
           RETURNING state
         )
         SELECT state FROM inserted UNION ALL SELECT state FROM transitioned`,
        [refundReference, nextState],
      );
      return result.rows.length === 1;
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
    async hasRefundReference(refundReference) {
      const result = await receiptClient.query(
        `SELECT 1 FROM receipt.trusted_refund_references WHERE refund_reference = $1`,
        [refundReference],
      );
      return result.rows.length === 1;
    },
    async findClaimByMessageReference(messageReference) {
      const result = await receiptClient.query(
        `SELECT id, claim_type AS type, message_reference AS "messageReference",
                completion_deadline_at AS "completionDeadlineAt", verdict,
                last_checked_at AS "lastCheckedAt", first_proven_at AS "firstProvenAt",
                monitoring_ends_at AS "monitoringEndsAt"
           FROM receipt.claims
          WHERE message_reference = $1`,
        [messageReference],
      );
      return result.rows[0] ?? null;
    },
    async findClaimByRefundReference(refundReference) {
      const result = await receiptClient.query(
        `SELECT claim.id, claim.claim_type AS type, claim.message_reference AS "messageReference",
                claim.refund_reference AS "refundReference", claim.completion_deadline_at AS "completionDeadlineAt",
                claim.verdict, claim.last_checked_at AS "lastCheckedAt",
                claim.first_proven_at AS "firstProvenAt", claim.monitoring_ends_at AS "monitoringEndsAt"
           FROM receipt.claims AS claim
          WHERE claim.refund_reference = $1`,
        [refundReference],
      );
      return result.rows[0] ?? null;
    },

    async recordTriggeredVerification({ claim, checkedAt, refundState, verdict, monitoringEndsAt }) {
      await receiptClient.query(
        `WITH transition AS (
           UPDATE receipt.claims
              SET verdict = $1, last_checked_at = $2,
                  first_proven_at = CASE WHEN $1 = 'PROVEN' THEN COALESCE(first_proven_at, $2) ELSE first_proven_at END,
                  monitoring_ends_at = CASE WHEN $1 = 'PROVEN' THEN COALESCE(monitoring_ends_at, $3) ELSE monitoring_ends_at END,
                  first_conclusive_verdict = CASE WHEN $1 = 'PROVEN' THEN COALESCE(first_conclusive_verdict, 'PROVEN') ELSE first_conclusive_verdict END,
                  first_conclusive_at = CASE WHEN $1 = 'PROVEN' THEN COALESCE(first_conclusive_at, $2) ELSE first_conclusive_at END
            WHERE id = $4 AND verdict <> $1
            RETURNING id
         ), same_verdict AS (
           UPDATE receipt.claims SET last_checked_at = $2
            WHERE id = $4 AND NOT EXISTS (SELECT 1 FROM transition)
         ), authoritative_check AS (
           INSERT INTO receipt.authoritative_checks (claim_id, checked_at, refund_state, trigger)
           VALUES ($4, $2, $5, 'LEDGER_CHANGE')
         ), verdict_history_entry AS (
           INSERT INTO receipt.verdict_history (claim_id, verdict, recorded_at, trigger)
           SELECT id, $1, $2, 'LEDGER_CHANGE' FROM transition
         )
         INSERT INTO receipt.verification_schedule (claim_id, kind, due_at)
         SELECT id, 'MONITORING_FINAL', $3 FROM transition WHERE $3 IS NOT NULL
         ON CONFLICT DO NOTHING`,
        [verdict, checkedAt, monitoringEndsAt, claim.id, refundState],
      );
    },

    async findDueSchedule(now) {
      const result = await receiptClient.query(
        `SELECT schedule.id AS "scheduleId", schedule.kind, claim.id AS "claimId",
                claim.refund_reference AS "refundReference",
                claim.completion_deadline_at AS "completionDeadlineAt",
                claim.verdict AS "currentVerdict"
           FROM receipt.verification_schedule AS schedule
           JOIN receipt.claims AS claim ON claim.id = schedule.claim_id
          WHERE schedule.completed_at IS NULL AND schedule.claimed_at IS NULL AND schedule.due_at <= $1
          ORDER BY schedule.due_at`,
        [now.toISOString()],
      );
      return result.rows;
    },

    async claimDueSchedule(scheduleId, claimedAt) {
      const result = await receiptClient.query(
        `UPDATE receipt.verification_schedule SET claimed_at = $1
          WHERE id = $2 AND completed_at IS NULL AND claimed_at IS NULL
          RETURNING id`,
        [claimedAt, scheduleId],
      );
      return result.rows.length === 1;
    },

    async recordVerificationOutcome({ scheduleId, claimId, checkedAt, refundState, kind, currentVerdict, verdict }) {
      await receiptClient.query(
        `INSERT INTO receipt.authoritative_checks (claim_id, checked_at, refund_state, trigger)
         VALUES ($1, $2, $3, $4)`,
        [claimId, checkedAt, refundState, kind],
      );
      await receiptClient.query(
        `UPDATE receipt.claims SET verdict = $1, last_checked_at = $2 WHERE id = $3`,
        [verdict, checkedAt, claimId],
      );
      if (verdict !== currentVerdict) await receiptClient.query(
        `INSERT INTO receipt.verdict_history (claim_id, verdict, recorded_at, trigger)
         VALUES ($1, $2, $3, $4)`, [claimId, verdict, checkedAt, kind],
      );
      await receiptClient.query(
        `UPDATE receipt.verification_schedule SET completed_at = $1 WHERE id = $2`,
        [checkedAt, scheduleId],
      );
    },

    async recordInconclusive({ scheduleId, claimId, checkedAt, kind }) {
      await receiptClient.query(
        `INSERT INTO receipt.authoritative_checks (claim_id, checked_at, refund_state, trigger)
         VALUES ($1, $2, 'READ_FAILED', $3)`, [claimId, checkedAt, kind],
      );
      await receiptClient.query(`UPDATE receipt.claims SET verdict = 'INCONCLUSIVE', last_checked_at = $1 WHERE id = $2`, [checkedAt, claimId]);
      await receiptClient.query(`INSERT INTO receipt.verdict_history (claim_id, verdict, recorded_at, trigger) VALUES ($1, 'INCONCLUSIVE', $2, $3)`, [claimId, checkedAt, kind]);
      await receiptClient.query(`UPDATE receipt.verification_schedule SET completed_at = $1 WHERE id = $2`, [checkedAt, scheduleId]);
      await receiptClient.query(`INSERT INTO receipt.verification_schedule (claim_id, kind, due_at) VALUES ($1, 'RETRY', $2)`, [claimId, new Date(new Date(checkedAt).getTime() + 5000).toISOString()]);
    },

    async storeClaimWithInitialCheckAndSchedule({
      contractVersion,
      claim,
      authoritativeCheck,
      schedule,
    }) {
      const statements = [
        {
          statement:
          `INSERT INTO receipt.contract_versions
             (version, claim_type, completion_deadline_ms, monitoring_window_ms)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (version) DO NOTHING`,
          values: [
            contractVersion.version,
            contractVersion.claimType,
            contractVersion.completionDeadlineMs,
            contractVersion.monitoringWindowMs,
          ],
        },
        {
          statement:
          `INSERT INTO receipt.claims
             (id, claim_type, message_reference, refund_reference, contract_version,
              recognized_at, completion_deadline_at, verdict, last_checked_at,
              first_proven_at, monitoring_ends_at, first_conclusive_verdict, first_conclusive_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          values: [
            claim.id,
            claim.type,
            claim.messageReference,
            claim.refundReference,
            claim.contractVersion,
            claim.recognizedAt,
            claim.completionDeadlineAt,
            claim.verdict,
            claim.lastCheckedAt,
            claim.firstProvenAt ?? null,
            claim.monitoringEndsAt ?? null,
            claim.firstConclusiveVerdict ?? null,
            claim.firstConclusiveAt ?? null,
          ],
        },
        {
          statement:
          `INSERT INTO receipt.authoritative_checks
             (claim_id, checked_at, refund_state, trigger)
           VALUES ($1, $2, $3, $4)`,
          values: [
            authoritativeCheck.claimId,
            authoritativeCheck.checkedAt,
            authoritativeCheck.refundState,
            authoritativeCheck.trigger,
          ],
        },
        ...schedule.map((item) => ({
          statement: `INSERT INTO receipt.verification_schedule (claim_id, kind, due_at, completed_at)
             VALUES ($1, $2, $3, $4)`,
          values: [item.claimId, item.kind, item.dueAt, item.completedAt ?? null],
        })),
      ];
      if (receiptClient.transaction) {
        await receiptClient.transaction(statements);
        return;
      }
      await receiptClient.query("BEGIN");
      try {
        for (const { statement, values } of statements) await receiptClient.query(statement, values);
        await receiptClient.query("COMMIT");
      } catch (error) {
        await receiptClient.query("ROLLBACK");
        throw error;
      }
    },
  };
}
