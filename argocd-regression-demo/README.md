# ArgoCD deploy-regression demo (Triggered Workflow)

Demonstrates **proactive, deploy-time regression detection**: an ArgoCD sync fires a webhook
into a HolmesGPT **Triggered Workflow**, and Holmes analyzes the just-deployed service for a
regression — no alert and no human in the loop. The deploy *itself* is the trigger.

The scenario: a bad deploy points one service at a **non-existent image tag**. The rollout
stalls on `ImagePullBackOff` while the old pods keep serving — a "quiet" regression that
usually wouldn't page anyone. ArgoCD's sync event triggers Holmes, which inspects the changed
workload, reads the offending Git commit, and reports the root cause to Slack.

## Prerequisites

- A Kubernetes cluster and `kubectl` access (plus `curl`, `sed`, `bash` locally).
- **HolmesGPT** running with a **Triggered Workflow** webhook endpoint (a URL + auth token).
- Holmes integrations: in-cluster **kubectl** access, **GitHub** read (to fetch the commit
  diff for the synced revision), and **Slack** (Holmes posts findings to a channel you choose).

ArgoCD itself does **not** need to be pre-installed — the script below installs a dedicated,
self-contained instance.

## One-time setup

1. **Install ArgoCD + deploy the app** (installs into its own `argocd-demo` namespace, so it
   won't clash with any existing ArgoCD):

   ```bash
   # minimal: ArgoCD + the demo Application, no Holmes wiring yet
   ./install-argocd.sh

   # or wire Holmes in at the same time:
   WEBHOOK_URL="https://<holmes-triggered-workflow>" WEBHOOK_TOKEN="<token>" ./install-argocd.sh
   ```

   Overridable via env vars: `NAMESPACE`, `ARGOCD_VERSION`, `REPO_URL`, `LIVE_BRANCH`,
   `WEBHOOK_URL`, `WEBHOOK_TOKEN` (see the top of `install-argocd.sh`).

2. **Create the branch ArgoCD tracks** (the live branch where the regression commit is made —
   kept separate from `main`):

   ```bash
   git checkout -b argocd-regression-demo-live main
   git push -u origin argocd-regression-demo-live
   ```

3. **Confirm the baseline is healthy:**

   ```bash
   kubectl get pods -n argocd-demo                       # all Running, incl. argocd-notifications-controller
   kubectl get applications -n argocd-demo storefront    # Synced / Healthy
   kubectl get pods -n storefront                        # frontend / api / worker Running
   ```

   ArgoCD UI (optional, for the recording):
   ```bash
   kubectl -n argocd-demo get secret argocd-initial-admin-secret -o jsonpath='{.data.password}'; echo
   kubectl port-forward svc/argocd-server -n argocd-demo 8080:443   # then https://localhost:8080 (user: admin)
   ```

4. Configure the Triggered Workflow in Holmes with the prompt in
   [`triggered-workflow-prompt.txt`](./triggered-workflow-prompt.txt).

## Running the demo

On the **live branch**, ship a bad deploy:

```bash
git checkout argocd-regression-demo-live
# change ONE service's image to a non-existent tag, e.g. in gitops/manifest.yaml:
#   image: nginx:1.99.9-nope      # was nginx:1.27.4
git commit -am "deploy frontend nginx:1.99.9-nope"
git push
```

Then watch it unfold:

```bash
kubectl get pods -n storefront -w     # new frontend pods -> ImagePullBackOff (old pods keep serving)
kubectl get applications -n argocd-demo storefront   # turns Degraded within ~30s
```

ArgoCD's `on-sync-succeeded` webhook fires → Holmes investigates and posts to Slack: the
affected service, the `ImagePullBackOff` symptom, the offending commit + exact line, and a
recommended revert.

## Re-running the demo

Reset to green, then repeat:

```bash
git checkout argocd-regression-demo-live
git reset --hard origin/main        # or: git revert HEAD
git push --force-with-lease          # (force only needed if you used reset)
```

ArgoCD self-heals the app back to Healthy. Re-run by pushing the bad image tag again (vary the
service or tag to keep each take distinct).

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
  so the UI also turns red quickly for the recording — but that's just visual; the webhook
  fires on the sync event.
- **Generic images.** The services run stock `nginx`; the broken image is never pulled, so
  nothing app-specific is needed. Swap in your own images/services to taste.

## Files

- `install-argocd.sh` — one-command installer (dedicated namespace, pinned ArgoCD, deploys the app).
- `gitops/manifest.yaml` — desired-state services ArgoCD watches (the healthy baseline).
- `argocd/application.yaml` — the ArgoCD Application (auto-sync).
- `argocd/notifications.yaml` — webhook → Holmes wiring (trigger + payload template + secret).
- `triggered-workflow-prompt.txt` — the Holmes regression-analysis prompt.
