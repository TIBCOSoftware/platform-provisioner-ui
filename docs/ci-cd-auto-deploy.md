# CI/CD: Staging auto-deploy & Production promotion

This document describes how `platform-provisioner-ui` is deployed to the cic2
**staging** and **production** environments, and how the GitOps auto-deploy works.

## TL;DR

- **Staging**: merge to `main` → CI builds an immutable image tag (`master-<sha>`)
  and force-pushes the gitops `staging` branch as (master chart + that tag) →
  ArgoCD auto-syncs. No review.
- **Production**: cut a version (`2.2.0`), re-tag the validated staging image,
  promote via a **gated** change to the gitops `production` branch → ArgoCD
  auto-syncs. (See [Production promotion — TODO](#production-promotion--todo); not built.)

## How the environments are wired (3 repos)

```
platform-provisioner-ui (this repo: source + CI)
   │  build → push image  ghcr.io/tibco/platform-provisioner-ui/platform-provisioner-ui:<tag>
   ▼
cicinfra-integration  setup/recipes/{staging,production}/4.provisioner-webgui-*.yaml
   │  (kind: helm-install, run via the helm-install pipeline — README "step 5")
   │  → setup/charts/provisioner-webui/templates/app-webui.yaml generates the
   │    ArgoCD Application `provisioner-{branchName}-webui`
   ▼
cicinfra-cic2-provisioner-webui (gitops repo)   ← ArgoCD continuously watches this
   │  charts/cic2-provisioner-webui
   │  branches: master = chart source of truth (LOCKED, see below)
   │            staging = staging deploy branch (CI force-pushes: master + image tag)
   │            production = production deploy branch
   ▼
ArgoCD provisioner-master-webui (staging) / provisioner-production-webui (prod) → cluster
```

Key point: ArgoCD watches the **gitops repo**, not `cicinfra-integration`. The
image tag is the value `release` in the chart. Historically the Application
hard-coded `release = branchName` (a floating `:master` / `:production` tag), so a
new build with the same tag never produced a Git diff and never auto-deployed —
images went live only by a manual ArgoCD restart.

### Why staging uses a dedicated `staging` branch

The gitops repo's **default branch (`master`) is locked by a repository ruleset**:
`Changes must be made through a pull request` + **2 approvals**, with **no bypass
actors** (verified by a live token test — direct push is rejected with `GH013`,
even for repo admins). The ruleset targets only `~DEFAULT_BRANCH`, so **any other
branch is freely pushable**.

So CI cannot write the image tag to `master`. Instead, staging's ArgoCD app watches
a dedicated unprotected `staging` branch. On each deploy, CI force-pushes `staging`
as **(latest `master` chart + the new image tag)** — staging's chart therefore stays
in sync with `master` automatically, and CI only ever owns the image tag.

## The mechanism: `gitopsManagedTag` + `gitopsBranch`

Two flags were added to the `provisioner-webui` chart (`cicinfra-integration`):

- `webui.gitopsManagedTag` (default `false`): when `true`, the generated Application
  omits `release`, so the gitops repo `values.yaml` owns the image tag.
- `webui.gitopsBranch` (default = `branchName`): which gitops branch ArgoCD watches.
  Staging sets it to `staging`.

The **staging recipe** sets both (`gitopsManagedTag: true`, `gitopsBranch: staging`).
**Production and all other envs are unaffected** (defaults preserve `release =
branchName` on the `branchName` branch).

## Staging — automatic (no review)

Workflow: [`.github/workflows/auto-deploy-staging.yml`](../.github/workflows/auto-deploy-staging.yml)

1. Merge a PR to `main` (path `provisioner-webui/**`) → workflow triggers.
2. Build & push `:master` (compat) + `:master-<sha>` (immutable).
3. Checkout the gitops `master` chart, set `release: master-<sha>`, **force-push** it
   as the `staging` branch.
4. ArgoCD `provisioner-master-webui` (targetRevision=`staging`) auto-syncs → staging
   runs `master-<sha>`.

### Preview a feature branch on staging (before merge)

Run **Auto deploy to staging** manually (`workflow_dispatch`) and set `branchName`
to your branch. It builds `:<branch>-<sha>` and points staging at it.

⚠️ Staging is a **single shared environment** — a branch preview overwrites whatever
`main` last deployed, and two people previewing at once means last-one-wins. When
done, deploy `main` again (or merge your branch).

### Rollback staging

Run [`.github/workflows/rollback-staging.yml`](../.github/workflows/rollback-staging.yml)
with a known-good `targetTag` (e.g. `master-abc1234`). It force-pushes `staging` back
to (master chart + that tag); ArgoCD syncs back. The old image still exists because
tags are immutable.

Find prior tags in the **Auto deploy to staging** run history or the GHCR tag list.

Notes:
- Image rollback = the rollback workflow (above). Chart rollback is a `master`
  concern (revert on master via PR) and flows to staging on the next deploy.
- Don't use the ArgoCD UI "Rollback" button — auto-sync re-applies Git and undoes it.

## One-time setup (prerequisites)

1. **cicinfra-integration** (PR): `gitopsManagedTag` + `gitopsBranch` flags and the
   staging recipe opt-in. Branch `feature/webui-staging-auto-deploy`.
2. **gitops repo**: create the `staging` branch from `master` with `release: "master"`
   (done; unprotected branch, no PR needed).
3. **Re-run the staging recipe once** via the helm-install pipeline
   (`provisioner-staging.cic2.tibcocloud.com/pipelines/helm-install`, README "step 5",
   `setup/recipes/staging/4.provisioner-webgui-staging.yaml`) so the staging
   Application is regenerated with `targetRevision=staging` and no inline `release`.
4. **Create repo secret `GITOPS_PUSH_TOKEN`** in this repo: a token with
   `contents:write` on `tibco/cicinfra-cic2-provisioner-webui`. (Verified it can push
   non-default branches; it does **not** need to push the locked default branch.)

After 1–4, every merge to `main` auto-deploys to staging.

---

## Production promotion — TODO

> Status: **designed, not implemented.** Scope chosen: staging first; build this next.

Goal: promote a **validated staging image** to production as an immutable, semver
tag (e.g. `2.2.0`), **gated** by review (production is not auto-deployed).

Planned flow:

1. Decide a `master-<sha>` on staging is good.
2. Tag the source: `git tag 2.2.0 <commit> && git push --tags` (provenance), or run a
   release `workflow_dispatch` with version + source sha.
3. **Release workflow** (TODO): re-tag the *same* image (no rebuild) —
   `docker buildx imagetools create -t <repo>:2.2.0 <repo>:master-<sha>` — so prod
   runs bit-identical to what staging validated.
4. Promote: set `release: "2.2.0"` on the gitops `production` branch.
5. ArgoCD `provisioner-production-webui` auto-syncs → prod runs `2.2.0`.

One-time prod prerequisites (mirror of staging, but gated):

- [ ] `cicinfra-integration` production recipe `4.provisioner-webgui-production.yaml`:
      add `gitopsManagedTag: true` (keep `branchName: production`; no `gitopsBranch`
      override needed — production keeps watching the `production` branch).
- [ ] gitops `production` branch `values.yaml`: set `release: "production"` first
      (behavior-preserving), then promotions bump it to the semver.
- [ ] Re-run the production recipe once (helm-install pipeline).

The production GATE (important): the ruleset only locks `~DEFAULT_BRANCH` (`master`),
so the `production` branch is currently **not** ruleset-protected. To gate prod, do
**one** of:
- [ ] add a ruleset/branch protection on `production` (require PR + reviews), and
      promote via PR; or
- [ ] gate the promote workflow behind a GitHub **Environment** `production` with
      required reviewers (the job pushes only after approval).

Implementation tasks (TODO):

- [ ] `.github/workflows/release-promote-production.yml`: re-tag image + update the
      `production` branch behind the chosen gate.
- [ ] Decide tag style: `2.2.0` (matches existing registry tags) vs `v2.2.0`.
- [ ] Production rollback (same as staging, but on the `production` branch).
- [ ] Optionally retire/alias the floating `:production` tag once semver is in place.

Out of scope (heavier, only if needed later): per-PR ephemeral preview environments
(dynamic ArgoCD ApplicationSet per PR) instead of a single shared staging.
