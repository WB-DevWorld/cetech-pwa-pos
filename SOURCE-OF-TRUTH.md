# Project authority

Current explicit human instructions govern work and must be recorded when they change architecture. Within repository project truth, precedence is:

1. Approved ADRs.
2. Current architecture documents.
3. Current contracts/interfaces.
4. Current engineering standards.
5. Current task/workstream specification.
6. Approved project documentation.
7. Historical project conversations.
8. Personal ChatGPT/Cursor memory.
9. Agent assumptions.

Git/repository truth outranks private AI memory.
A historical ChatGPT conversation cannot override a newer approved ADR or current contract.
Generated code cannot silently redefine architecture.
Cursor conversation history is not canonical project truth.

Runtime evidence describes what exists; it cannot silently approve a design change. Disagreement becomes an issue/ADR with evidence and chronology. Never treat absence of a test failure as approval.

CURRENT = controlling now; TRANSITIONAL = controlling for the immediate provider arrangement; TARGET = intended future; SUPERSEDED = replaced; PROPOSED = awaiting approval; UNRESOLVED = decision missing; UNVERIFIED = live fact not checked.

ADRs 001–010 encode this turn's explicitly authorized baseline and contract resolutions. New deployment/business facts remain UNVERIFIED. The upstream Transfer Kit v1.0.1 remains shared methodology, not a competing project constitution. Its duplicated generic priority lists yield to this explicit project hierarchy. Raw chats and broad user knowledge are not copied into Git.
