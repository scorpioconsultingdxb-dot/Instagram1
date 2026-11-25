# Viewora — Agency & Team Collaboration Guide (Stage 26)

## Overview

The Agency & Team Collaboration Center (`/[locale]/dashboard/agency`) provides isolated multi-client workspaces, role-based team seat management, shared research projects, internal team commentary, and workspace activity auditing.

## Architecture & Isolation Guarantees

1. **Multi-Client Workspaces:** Each client container stores `clientName`, `industry`, `brandColor`, `reportHeader`, `sharedProjectTitles`, and `sharedReportIds`. Server-side `assertWorkspaceOwnership()` strictly enforces cross-account and cross-client isolation.
2. **Role-Based Access Control:** Supports `owner`, `admin`, `editor`, and `viewer` workspace roles. Owner roles cannot be demoted or revoked via member management endpoints.
3. **Server-Side Quota Enforcement:**
   - **Team Seats (`team_seats`):** Free/Starter/Premium = `1` seat, Pro = `3` seats, Agency = `15` seats. Invitations exceeding active seats return `HTTP 403`.
   - **Client Workspaces (`workspaces`):** Free–Pro = `1` workspace, Agency = `25` workspaces. Creating workspaces beyond tier entitlements returns `HTTP 403`.
4. **Private Personal Note Isolation:** Internal team comments (`AgencyTeamCommentRecord`) are stored in a completely separate namespace scoped by `workspaceId` and **never** read, mirror, or expose personal `SavedProfileRecord.privateNote` fields.
5. **Honest Email Invitation Disclosure:** While external Resend email dispatch remains inactive, invitations are recorded in the workspace roster with an explicit disclosure (`External email delivery is inactive until provider authorization`). Dev token previews are never emitted in production (`NODE_ENV === 'production'`).

## Verification Status

**Implemented & Locally Tested** (`src/lib/agency/service.ts`, `src/app/api/agency/route.ts`, `src/components/dashboard/AgencyCollaborationModule.tsx`, Vitest + Headless Chrome).
