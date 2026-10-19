# Dealership and Admin permissions

Baseline `d6ae115359c4d0ae7ab0fd5115336291666cbb08` · 2026-10-02 (Asia/Calcutta, UTC+05:30). Local isolated pre-production simulation; no production connection or application fix.

| Capability                                    | OWNER                        | MANAGER      | STAFF        | Ordinary customer           |
| --------------------------------------------- | ---------------------------- | ------------ | ------------ | --------------------------- |
| Dealer dashboard/inventory                    | Allow                        | Allow        | Allow        | Deny without membership     |
| Prepare/edit permitted draft                  | Allow                        | Allow        | Allow        | Deny                        |
| Submit / reserve / sell / withdraw            | Allow                        | Allow        | Deny         | Deny                        |
| Read dealer enquiry contact information       | Allow                        | Allow        | Allow        | Own personal enquiries only |
| NEW → CONTACTED                               | Allow                        | Allow        | Allow        | Deny dealer mutation        |
| Close / SPAM / privileged enquiry transitions | Allow                        | Allow        | Deny         | Deny                        |
| Protected profile/KYC changes                 | Allow                        | Deny         | Deny         | Deny                        |
| Team invitations/role changes/removal         | Allow; final OWNER protected | Deny         | Deny         | Deny                        |
| Admin API                                     | Deny                         | Deny         | Deny         | Deny                        |
| Personal saved/enquiry actions                | Human scoped                 | Human scoped | Human scoped | Human scoped                |

Admin SUPPORT, MODERATOR and SUPER_ADMIN permissions are separate from dealer roles and require an active scoped Admin session/seat. Table describes intended architecture; granular executed results are in the registry. Direct STAFF submit/reserve/mark-sold/withdraw tests returned 403, cross-role Team APIs denied, and owner-only profile/document tests passed. Changing client state cannot supply a different dealer or role. A role is re-read on the next request; commit-time revocation safety failed BUG-005.

Evidence: dealer-roles, dealer-team and dealer-tenancy-hardening exact assertions in [api-assertions.json](evidence/ci/api-assertions.json); [follow-up probes](evidence/security/followup-probes.json). Admin live Google sign-in remains blocked.
