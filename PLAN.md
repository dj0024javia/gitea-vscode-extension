# Gitea VSCode Extension Plan

## Goal
Build a VSCode extension that mirrors core GitHub extension workflows for Gitea:
- Pull requests: list, view details, checkout branches, create/review/comment/merge
- Actions-like CI view: workflows/runs/jobs/logs/status
- Auth/account/repo context management for self-hosted Gitea instances

## Scope (Phase 1)
1. Extension bootstrap and architecture
   - TypeScript VSCode extension scaffold
   - API client layer for Gitea REST/GraphQL (as available)
   - Configuration for multiple Gitea servers and tokens
2. Pull Request features
   - Tree views: assigned, created, mentioned PRs
   - PR details panel: commits, files changed, checks, comments
   - PR actions: checkout branch, open diff, add review comment, approve/request changes, merge
3. CI/Actions-like features
   - Workflow/runs explorer (mapped to Gitea Actions APIs)
   - Run detail view with jobs/steps/logs and status badges
   - Quick actions: rerun/cancel/open in browser
4. UX and reliability
   - Status bar context (repo/branch/account)
   - Command palette entries for all core operations
   - Caching, pagination, and robust error handling

## Scope (Phase 2)
- Notifications and activity feed
- Inline code review annotations in editor
- Advanced filtering/search/saved queries
- Enterprise/self-hosted admin controls

## Technical Notes
- Use VSCode APIs: TreeDataProvider, WebviewView, Authentication/SecretStorage
- Keep API layer strongly typed and isolated from UI commands
- Add integration tests for command handlers and API adapters

## Milestones
1. Bootstrap + auth + repo detection
2. PR list/detail/read-only
3. PR write operations (review/merge)
4. CI runs/jobs/logs
5. Polish + packaging + marketplace docs
