# Preserve repeated Claims but deduplicate deliveries

Receipt will treat the same recognized statement delivered more than once as one Claim, while treating a repeated statement in a later agent message as a separate Claim even when both concern the same real-world outcome. Related Claims may be grouped in the interface, but each keeps its own Completion Deadline, Contract Version, Proof Card, and Verdict History; this prevents delivery retries from inflating the record without erasing when each genuine promise was made or whether it was true at that time.
