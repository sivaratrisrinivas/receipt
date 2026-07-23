import readline from "node:readline";
import {
  CONTRACT,
  createPrototypeState,
  dispatch,
} from "./machine.mjs";

const bold = "\u001b[1m";
const dim = "\u001b[2m";
const reset = "\u001b[0m";

let state = createPrototypeState();

const value = (input) => (input === null ? "—" : String(input));

function render() {
  console.clear();
  const claim = state.claim;
  const history =
    claim?.verdictHistory
      .map((entry) => `${entry.verdict}@${entry.at}s`)
      .join(" → ") ?? "—";

  console.log(`${bold}Receipt refund_completed prototype${reset}`);
  console.log(
    `${dim}In-memory only; MCP, SigNoz, OpenTelemetry, and Neon are not exercised.${reset}\n`,
  );
  console.log(`${bold}Clock${reset}: ${state.now}s`);
  console.log(`${bold}Refund State${reset}: ${state.refundState}`);
  console.log(`${bold}Claim${reset}: ${claim?.type ?? "NOT_RECOGNIZED"}`);
  console.log(`${bold}Verdict${reset}: ${claim?.currentVerdict ?? "—"}`);
  console.log(`${bold}First Conclusive${reset}: ${value(claim?.firstConclusiveVerdict ?? null)}`);
  console.log(`${bold}Deadline${reset}: ${value(claim?.completionDeadlineAt ?? null)}s`);
  console.log(`${bold}Monitoring End${reset}: ${value(claim?.monitoringEndAt ?? null)}s`);
  console.log(`${bold}Next Monitor${reset}: ${value(claim?.nextMonitoringAt ?? null)}s`);
  console.log(`${bold}Next Retry${reset}: ${value(claim?.nextRetryAt ?? null)}s`);
  console.log(`${bold}Ledger Read${reset}: ${state.authoritativeRead.lastResult}`);
  console.log(`${bold}Evidence Trail${reset}: ${state.evidenceTrailHealth}`);
  console.log(`${bold}History${reset}: ${history}`);
  console.log(`${bold}Reason${reset}: ${claim?.reason ?? "—"}`);
  console.log(`${bold}Last action${reset}: ${state.lastAction}`);
  if (state.lastError !== null) {
    console.log(`${bold}Rejected${reset}: ${state.lastError}`);
  }

  console.log(`\n${bold}Actions${reset}`);
  console.log(
    "[r] recognize  [v] verify  [d] post-deadline  [m] monitor  [z] final",
  );
  console.log(
    "[p] processing [s] succeeded [x] rejected      [i] investigator recheck",
  );
  console.log(
    "[f] fail read [y] retry     [g] telemetry gap  [c] restore telemetry",
  );
  console.log("[e] reset     [q] quit");
  console.log(
    `\n${dim}Contract: deadline ${CONTRACT.deadlineSeconds}s; monitoring ${CONTRACT.monitoringSeconds}s; interval ${CONTRACT.monitoringIntervalSeconds}s.${reset}`,
  );
}

const actions = {
  r: { type: "RECOGNIZE_CLAIM" },
  v: { type: "VERIFY", trigger: "MANUAL" },
  d: { type: "ADVANCE_POST_DEADLINE" },
  m: { type: "MONITOR" },
  z: { type: "FINAL_CHECK" },
  p: { type: "LEDGER_TRANSITION", next: "PROCESSING" },
  s: { type: "LEDGER_TRANSITION", next: "SUCCEEDED" },
  x: { type: "LEDGER_TRANSITION", next: "REJECTED" },
  i: { type: "VERIFY", trigger: "INVESTIGATOR_RECHECK" },
  f: { type: "FAIL_NEXT_READ" },
  y: { type: "RETRY" },
  g: { type: "GAP_TELEMETRY" },
  c: { type: "RESTORE_TELEMETRY" },
  e: { type: "RESET" },
};

const terminal = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

render();
terminal.setPrompt("\nAction> ");
terminal.prompt();

terminal.on("line", (line) => {
  const key = line.trim().toLowerCase();
  if (key === "q") {
    terminal.close();
    return;
  }

  state =
    actions[key] === undefined
      ? { ...state, lastError: `Unknown key: ${key || "(empty)"}` }
      : dispatch(state, actions[key]);
  render();
  terminal.prompt();
});

terminal.on("close", () => {
  console.log("\nPrototype closed.");
});
