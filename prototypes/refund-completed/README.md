# Refund-completed logic prototype

> PROTOTYPE — throw away the terminal shell after the state-model question is
> answered.

## Question

Can one explicit `refund_completed` state machine represent immediate,
deadline, monitoring, final, retry, and Investigator Recheck triggers while
keeping the Verification Verdict independent from Evidence Trail Health?

This prototype is intentionally in-memory. It does not prove Neon persistence
or permissions, OpenTelemetry delivery, SigNoz queries, dashboards, alerts, or
MCP access.

## Run

From WSL:

```bash
nvm use
npm run prototype:refund
```

The terminal shows the entire current state after every action. Use the
single-letter commands printed at the bottom of the frame.
