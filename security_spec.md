# AstroGuard RBAC Security Specification (Phase 0)

## 1. Core Data Invariants
1. **Trusted Role Source**: User roles (`ASTRONAUT` | `MEDICAL_CHIEF`) and `crewId` mappings exist solely in `/users/{uid}` and `/provisionedAccounts/{emailKey}`. Self-registration as `MEDICAL_CHIEF` or modifying one's own `role`/`crewId`/`accountStatus` is unconditionally denied.
2. **Strict Astronaut Isolation**: An active `ASTRONAUT` may read/query only `crew/{ownCrewId}`, `healthRecords/{ownCrewId}`, `healthRecords/{ownCrewId}/history`, `healthRecords/{ownCrewId}/assessments`, `countermeasureRecords` where `crewId == ownCrewId`, and `alerts` where `crewId == ownCrewId`.
3. **No Full-Roster Listing for Astronauts**: `allow list` on `/crew`, `/healthRecords`, `/users`, `/surgeonNotes`, `/auditLogs`, and `/provisionedAccounts` is strictly forbidden for `ASTRONAUT`.
4. **Medical Chief Mission-Wide Authority**: A verified Firebase user with the server-issued `astroguardRole: MEDICAL_CHIEF` custom claim, or an active `/users/{uid}` profile with `role = MEDICAL_CHIEF`, can monitor all crew, read/write `surgeonNotes`, update `evaluationConfig`, acknowledge and separately resolve alerts, and read immutable `auditLogs`. There is no email-based bootstrap role.
5. **Acknowledgement vs. Resolution Separation**: Acknowledging an alert sets `acknowledgementStatus = 'ACKNOWLEDGED'` while preserving `resolutionStatus` (`OPEN` / `IN_REVIEW`). Critical alerts cannot be deleted or marked resolved by astronauts.
6. **Temporal & Schema Integrity**: Every create/update validates server `request.time`, strict allowed keys (`hasOnly`/`hasAll`), string lengths, and regex ID formats (`^[a-zA-Z0-9_\\-]+$`).

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated read of `/healthRecords/AG-LEO-01`**: `request.auth == null` -> DENIED.
2. **Self-assignment to Medical Chief on user creation**: `POST /users/{uid}` with `role: "MEDICAL_CHIEF"` by non-Medical-Chief -> DENIED.
3. **Privilege escalation via user update**: Astronaut `UPDATE /users/{uid}` changing `role` to `"MEDICAL_CHIEF"` or `crewId` to `"AG-LEO-02"` -> DENIED.
4. **Cross-crew health record read**: Astronaut 01 (`AG-LEO-01`) reading `/healthRecords/AG-LEO-02` -> DENIED.
5. **Cross-crew history read**: Astronaut 01 (`AG-LEO-01`) listing `/healthRecords/AG-LEO-02/history` -> DENIED.
6. **Full crew roster scraping**: Astronaut 01 running `list` query on `/crew` -> DENIED.
7. **Unfiltered alert query scraping**: Astronaut 01 running `list` on `/alerts` without `where('crewId', '==', 'AG-LEO-01')` -> DENIED.
8. **Astronaut reading private Flight Surgeon notes**: Astronaut 01 reading `/surgeonNotes/{noteId}` -> DENIED.
9. **Astronaut modifying evaluation thresholds**: Astronaut 01 updating `/evaluationConfig/default` -> DENIED.
10. **Astronaut resolving or deleting a CRITICAL alert**: Astronaut updating `resolutionStatus` to `'RESOLVED'` or deleting `/alerts/{alertId}` -> DENIED.
11. **Shadow/Ghost field injection**: Writing `{ ..., isVerifiedAdmin: true }` to `/alerts/{alertId}` or `/users/{uid}` -> DENIED by `hasOnly`.
12. **Audit log tampering or spoofing**: Updating/deleting `/auditLogs/{logId}` or creating an entry with mismatched `actorUserId`, `actorEmail`, `actorRole`, or forged timestamp -> DENIED.
