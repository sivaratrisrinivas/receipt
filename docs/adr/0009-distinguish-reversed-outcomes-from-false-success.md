# Distinguish reversed outcomes from false success

When later Authoritative Evidence stops supporting a previously `PROVEN` Claim, Receipt will append a `REVERSED` Verification Verdict while preserving the earlier proof in Verdict History. It will not relabel the outcome `FALSE_SUCCESS`, because that would incorrectly say the agent's promise was false when Receipt originally verified it; this distinction keeps agent error separate from a real-world outcome that changed later.
