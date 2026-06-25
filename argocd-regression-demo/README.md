# ArgoCD deploy-regression demo (Triggered Workflow)

Demonstrates **proactive, deploy-time regression detection**: an ArgoCD sync fires a webhook
into a HolmesGPT **Triggered Workflow**, and Holmes analyzes the just-deployed service for a
regression — no alert and no human in the loop. The deploy *itself* is the trigger.

The scenario: a bad deploy points one service at a **non-existent image tag**. The rollout
stalls on `ImagePullBackOff` while the old pods keep serving — a "quiet" regression that
usually wouldn't page anyone. ArgoCD's sync event triggers Holmes, which inspects the changed
workload, reads the offending Git commit, and reports the root cause to Slack.

## Prerequisites

Set these up before running the demo:

1. A Kubernetes cluster and `kubectl` access.
2. **ArgoCD** installed, including its bundled **notifications controller** (ships with ArgoCD).
3. **HolmesGPT** running with a **Triggered Workflow** webhook endpoint (a URL + auth token
   that starts an investigation from an inbound webhook).
4. Holmes integrations:
   - in-cluster **kubectl** access,
   - **GitHub** read access (to fetch the commit diff for the synced revision),
   - **Slack** (Holmes posts its findings to a channel you choose).
5. A **dedicated Git branch** that ArgoCD will track (not `main`) — the regression commit is
   made here on camera, then reverted. Create it from this repo, e.g. `argocd-regression-demo-live`.

## Setup

1. Fill in the placeholders:
   - `argocd/application.yaml` → `__REPO_URL__`, `__LIVE_BRANCH__`
   - `argocd/notifications.yaml` → `__WEBHOOK_URL__`, `__WEBHOOK_TOKEN__`
2. Configure the Triggered Workflow in Holmes with the prompt in
   [`triggered-workflow-prompt.txt`](./triggered-workflow-prompt.txt).
3. Apply the notifications config and the Application:
   ```bash
   kubectl apply -f argocd/notifications.yaml
   kubectl apply -f argocd/application.yaml
   ```
4. Confirm the baseline is healthy: in the ArgoCD UI the `storefront` app is **Synced /
   Healthy**, and `kubectl get pods -n storefront` shows `frontend`, `api`, `worker` Running.

## Run the demo

1. On the tracked branch, edit `gitops/manifest.yaml` and change **one** service's image to a
   non-existent tag, e.g.:
   ```yaml
   # frontend Deployment
   image: nginx:1.99.9-nope   # was nginx:1.27.4
   ```
2. Commit and push to the tracked branch.
3. ArgoCD auto-syncs the new revision → the new `frontend` pods get stuck in
   `ImagePullBackOff` (old pods keep serving) → the `on-sync-succeeded` webhook fires.
4. Holmes investigates and posts to Slack: the affected service, the `ImagePullBackOff`
   symptom, the offending commit and exact line (the bad image tag), and a recommended revert.
5. **Reset:** `git revert` the commit (or reset the branch); ArgoCD self-heals back to green.

## How it works

```
git push (bad image tag) ─▶ ArgoCD auto-sync ─▶ on-sync-succeeded webhook
   └▶ Holmes Triggered Workflow
        ├─ kubectl rollout history / describe / events on the changed deploy
        ├─ reads the synced commit diff from GitHub → the image-tag change
        └▶ posts verdict + offending commit to Slack
```

- **Why trigger on sync, not health?** `on-sync-succeeded` fires within seconds of the revision
  being applied. ArgoCD only marks the app `Degraded` after a Deployment's
  `progressDeadlineSeconds` of stalled rollout (default 600s). The manifests set it to `30s`
  so the ArgoCD UI also turns red quickly for the recording — but that's just visual; the
  webhook fires on the sync event.
- **Generic images.** The services run stock `nginx`; the broken image is never pulled, so
  nothing app-specific is needed. Swap in your own images/services to taste.
