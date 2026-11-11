# Phase 18 — Cross-dashboard integration audit

Base: `phase-19-security-regression-hardening`

## Verified workflow route map

| Workflow | Public / student entry | Staff workflow | Backend status / operation |
|---|---|---|---|
| Application submission | `POST /api/public/apply`, `POST /api/public/apply-hnd` | Admission Officer / Admin application queues | Application record created |
| Application status | `GET /api/public/apply-status` | Admission Officer review | pending → under_review → approved / rejected |
| Admission registration | Public application record | Admission Officer / Admin registration; Registrar admitted/registration views | approved → registered; user account and matric number created |
| Matriculation | Public admission letter endpoint | Admission Officer matriculation action | registered/approved → matriculated |
| Payment | Student fee view / payment initiation | Bursar payment verification | pending → verified / rejected; refunds handled separately |
| Student academic record | Student dashboard, results, transcript | Lecturer/HOD/Exam Officer/Academic Officer publication workflow | Published results feed student views |
| Documents | Student document requests | Bursar review/issue and Registrar document register | pending → approved / rejected / issued |

## Integration defect corrected

The Admission Officer matriculation endpoint previously generated or accepted a matric number but only saved that number. It did not change the application status to `matriculated`, nor set the matriculation timestamp / third-letter timestamp through the shared application query helper.

The public admission-letter route explicitly allows the `matriculated` state and selects the matriculation letter for that state. This mismatch could therefore leave a successfully matriculated applicant unable to access the expected public matriculation letter.

The endpoint now uses the shared `appQueries.setStatus(app.id, 'matriculated', { matricNumber, reviewedBy })` transition. This also applies the shared timestamp and letter tracking fields.

## Payment workflow correction

The Bursar and Admin payment verification/rejection actions previously updated a payment by ID without restricting the prior state. This allowed a previously verified or rejected record to be overwritten by a later action.

The shared payment query now applies a database-side `status = 'pending'` condition to both verification and rejection. Both the Bursar and Admin routes now distinguish missing records (404) from non-pending records (409), and return a conflict if the record changes between the initial read and conditional update. This protects the Student fee balance from accidental repeat or contradictory payment decisions.

Student fee balances were also traced to count only `verified`, `completed` or `success` payment statuses; pending and rejected payments are not included in `totalPaid`.

## Document issuance correction

The Student document request endpoint creates records in `pending` status, and the Student documents page reads issued status, file URL, issuer identity and issuer signature from those records. The Registrar upload/mark-issued actions and Bursar approve/issue/reject actions are now constrained to valid state transitions:

- Bursar approval: `pending → approved` only.
- Bursar issuance: `approved → issued` only.
- Bursar rejection: `pending|approved → rejected` only.
- Registrar upload/issue and transcript mark-issued: pending or approved requests only.

The updates use conditional database writes, so stale or repeated actions receive a conflict response rather than silently overwriting an already-issued or rejected request. Student visibility remains driven by the same document record and its issued file/issuer fields.

## Results approval and publication correction

The results workflow is now guarded across the Lecturer and HOD portal endpoints:

- Lecturer result entry can update an existing record only while it is `draft` or `hod_rejected`; an already-submitted, HOD-verified, academically approved or published result cannot be reset to draft.
- Lecturer edit and delete actions are restricted to draft/HOD-rejected records, with explicit not-found and conflict responses.
- HOD single-result verification and rejection now handle failed state transitions as conflicts rather than proceeding with a missing update.
- HOD bulk verification checks that every selected record is still `submitted` and applies a database-side status condition.
- The HOD ready-to-publish list now shows academically approved records, and HOD publication only changes `approved → published`. HOD-verified records must first pass the Academic Officer/Admin approval stage.

These changes align the portal-specific endpoints with the central result transition helpers in `routes/results.js` and `db/queries/results.js`.

## Remaining validation

- Exercise public ND and HND application submissions with test records.
- Confirm admission approval, registration and matriculation with an authenticated Admission Officer account.
- Confirm public status lookup and all three letter types.
- Verify a registered student sees verified payments, published results and issued documents in the Student dashboard.
- Confirm Bursar and Registrar views reflect the same underlying payment/document state.
- Run end-to-end tests against a staging database before merging.

## Scope note

This is a source-level integration correction and route audit. It has not been tested against live user accounts or production data. No production deployment was triggered.
