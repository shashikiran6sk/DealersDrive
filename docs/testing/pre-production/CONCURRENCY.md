# Race outcomes and launch gates

Baseline `d6ae115359c4d0ae7ab0fd5115336291666cbb08` · 2026-10-02 (Asia/Calcutta, UTC+05:30). Local isolated pre-production simulation; no production connection or application fix.

| Race                                         | Executed result                                | Evidence                                                       |
| -------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| Five identical customer enquiries            | One 201, four 409; one stored lead             | API-PROBE-010                                                  |
| Five identical saves                         | One stored saved record                        | API-PROBE-011                                                  |
| Two invitation accepts                       | One membership                                 | dealer-team exact assertions                                   |
| Reserve vs sell; sell vs withdraw            | One valid winning lifecycle state              | dealer-listing-lifecycle / dealer-tenancy-hardening assertions |
| Admin approve vs reject                      | One decision and one audit outcome             | listing-approval / moderation-decisions assertions             |
| Concurrent enquiry status updates            | Serialized valid transition                    | dealer-enquiries / tenancy-hardening assertions                |
| Invitation accept vs withdrawal              | **FAIL**, losing withdrawal HTTP 500           | BUG-001; full baseline suite                                   |
| Member removal before blocked submit commits | **FAIL**, removed actor commits PENDING_REVIEW | BUG-005; lock wait proved by independent observer              |

The first revocation observer reused a transaction snapshot and could not prove the wait; that attempt remains BLOCKED in followup-probes.json. The corrected probe used an independent observer, observed a real Lock wait, committed removal, then released the row lock. This was a harness correction, not an application fix. Two-staff editing, suspension-vs-submit, review-vs-edit and other unmapped races remain BLOCKED. A suite-wide green rerun was not used to hide the invitation failure.

Evidence: [race trace](evidence/concurrency/revocation-in-flight.json), [API outcomes](evidence/security/api-probes.json), [assertion records](evidence/ci/api-assertions.json).
