# Recognize Claims outside the agent

Receipt will inspect the agent's final user-facing words in a separate Claim Recognition step rather than trusting the agent to declare or omit its own Claims. Recognition may use AI to return a supported Claim Type and Safe Claim Summary, but it cannot choose the Claim's trusted subject and the deterministic Verifier alone decides truth from Authoritative Evidence; this adds a separate interpretation step in exchange for an independent claim-ingestion boundary.
