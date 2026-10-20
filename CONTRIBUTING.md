# How changes ship

Cynatra uses **trunk-based development**: `main` is always releasable, and every
change reaches it through a short-lived branch and a pull request.

1. **Branch** from `main`: `feat/group-picking`, `fix/login-redirect`, `chore/deps`.
   Keep it small (hours to a couple of days, not weeks).
2. **Open a pull request.** The template asks what changed and how it was checked.
3. **CI must pass** (`.github/workflows/ci.yml`): web lint, types and build;
   gateway types and tests (with a real Postgres); picker gofmt, vet and tests;
   both Kubernetes overlays render; workflow lint. The `main` ruleset won't
   allow a merge until they're green, and blocks direct pushes and force pushes.
4. **Squash-merge.** One commit per change on `main`, titled like the PR.
5. **Staging** gets it automatically (https://staging.cynatra.app, password in
   `staging-login.txt`, which only lives on the maintainer's machine).
6. **Production:** once it looks right on staging, approve the waiting
   **deploy-production** job (Actions → Images → Review deployments). A GitHub
   Release with notes is created for every production deploy.

Rolling back is re-running an older run's deploy-production job. Deployment
details: [DEPLOY.md](DEPLOY.md).

## Housekeeping

- Bugs and ideas go in GitHub Issues (templates provided).
- Dependabot opens weekly update PRs; the Security workflow checks for known
  vulnerabilities on every push and weekly.
- Secrets never go in git. Local settings live in `.env` (see `.env.example`).
