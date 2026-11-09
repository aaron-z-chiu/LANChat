# Known limits and follow-up acceptance criteria

LANChat currently targets small, trusted IPv4 LANs. The following items remain open beyond the existing messaging and recovery features.

| Area | Current boundary | Useful follow-up and completion criterion |
| --- | --- | --- |
| Trust | Peer identity and message authorship are not authenticated; traffic and local history lack encryption | Specify a threat model and authenticated key exchange; test rejection of impersonation before claiming secure messaging |
| Network coverage | Physical evidence covers two hosts on shared Wi-Fi; discovery retry and initial fallback occurred | Repeat across a third physical host, multiple interfaces, sleep/wake and restrictive firewalls; retain failures and recovery times |
| Large histories | UI loads full history; delivery-state lookups and scope-change rescans add work | Add measured history-size workloads before choosing pagination/index changes; report memory and interaction latency |
| Concurrent group edits | Whole-snapshot deterministic selection may discard a concurrent edit | Define intended merge semantics; add concurrent edit/leave scenarios before changing the algorithm |
| Temporary rooms | Expiry stops new sends but preserves histories and depends on clocks | Document retention separately from expiry; verify clock-skew behavior before offering stronger expiry claims |
| Distribution | Build produces local application assets, not signed installers or automatic updates | Produce and verify platform packages on clean target hosts; record signing/notarization and installation behavior |
| Performance claims | Controlled model and loopback results have narrower scope than real Wi-Fi performance | Collect repeated physical measurements with environment, payload, raw samples and uncertainty; do not claim LRDT is faster by default |
| Resource pressure | Existing bounds do not establish comprehensive flood control or disk quotas | Define bounded queue/storage policies and test sustained traffic under explicit resource budgets |

## Next steps

1. Run the regression checklist and retain the command output.
2. Extend physical network validation and document intermittent startup behavior.
3. Measure history growth before optimizing storage or rendering.
4. Address authentication and encryption before sensitive deployment.
5. Package for distribution when installation is a project requirement.

File transfer, mobile clients, IPv6 and Internet relays remain outside the current project scope.
