# ArgoCD + Loki log-analysis demo

Demonstrates HolmesGPT catching a problem that **health checks can't see**: a new version
deploys, the pods are Running and `/healthz` is green — but the **logs** show the new build is
silently failing. An ArgoCD sync fires a webhook into a HolmesGPT **Triggered Workflow**, which
compares **Loki logs before vs after** the deploy and classifies what changed.

Why Loki: after a deploy the old pods are gone, so only centralized logs retain the *pre-deploy*
baseline — that's what lets Holmes say "this error is new" vs "that was already there".

The app (`checkout-api`) ships as two real image tags. `:v1` is the healthy baseline; `:v2`
keeps returning `200` but its pricing path throws on some orders (totals silently break), plus a
harmless new deprecation warning. The "deploy" is an honest **image-tag bump** in git — nothing
at runtime marks it as a demo.

## Prerequisites

- A Kubernetes cluster + `kubectl` (and `curl`/`sed`/`bash`).
- **HolmesGPT** with a **Triggered Workflow** webhook endpoint (URL + token).
- Holmes integrations:
  - the **`grafana/loki` toolset** pointed at `http://loki.logging:3100`,
  - the **`kubernetes/logs` toolset disabled** (so Holmes uses Loki and sees pre-deploy history),
  - **GitHub** read (to inspect the deploy's commit), and **Slack**.
- ArgoCD does **not** need to be pre-installed — `install.sh` installs a dedicated instance.
- A dedicated Git branch ArgoCD tracks (created from a branch that already contains this folder).

## One-time setup

1. **Build + push the images** (maintainer step):
   ```bash
   ./build.sh   # builds + pushes checkout-api:v1 and :v2
   ```
2. **Install everything** (ArgoCD → `argocd-demo`, Loki → `logging`, app → `checkout`):
   ```bash
   ./install.sh
   # or wire Holmes in at the same time:
   WEBHOOK_URL="https://<holmes-triggered-workflow>" WEBHOOK_TOKEN="<token>" ./install.sh
   ```
3. **Create the branch ArgoCD tracks** (separate from `main`). Create it from a branch that
   already contains `argocd-log-analysis-demo/`:
   ```bash
   git checkout -b argocd-log-analysis-demo-live main
   git push -u origin argocd-log-analysis-demo-live
   ```
   > Until this folder is merged into `main`, branch from wherever it currently lives instead.
4. Configure the Triggered Workflow in Holmes with the prompt in
   [`triggered-workflow-prompt.txt`](./triggered-workflow-prompt.txt).
5. **Confirm baseline healthy:**
   ```bash
   kubectl get applications -n argocd-demo checkout   # Synced / Healthy
   kubectl get pods -n checkout                       # checkout-api Running (2/2 with sidecar)
   kubectl get pods -n logging                        # loki Running
   ```

## Running the demo

On the live branch, ship the new version — a one-line image-tag bump:

```bash
git checkout argocd-log-analysis-demo-live
# in gitops/manifest.yaml, change the checkout-api image:
#   image: .../checkout-api:v2     # was :v1
git commit -am "deploy checkout-api v2"
git push
```

ArgoCD auto-syncs → `checkout-api` rolls out to `:v2` (pods stay healthy) → the
`on-sync-succeeded` webhook fires → Holmes compares Loki logs before/after and posts to
`#argocd-deploys`: it flags the **new pricing exception** (despite `200`s) as the real issue,
calls the deprecation warning **noise**, and recognizes the recurring cache-miss warning as
**pre-existing**.

## Re-running the demo

Reset to green by **reverting** the bump (keeps the demo files on the branch):

```bash
git checkout argocd-log-analysis-demo-live
git revert --no-edit HEAD
git push
```

ArgoCD self-heals back to `:v1`. Re-run by bumping to `:v2` again.

## Cleanup

```bash
./install.sh --uninstall
```

Removes the `checkout`, `logging`, and `argocd-demo` namespaces. It leaves ArgoCD's
cluster-scoped resources in place (they may be shared with another ArgoCD); the script prints
the optional commands to remove those too.

## How it works

```
git bump image :v1→:v2 ─▶ ArgoCD auto-sync ─▶ on-sync-succeeded webhook
   └▶ Holmes Triggered Workflow
        ├─ query Loki for this app's logs before vs after the deploy (re-query if needed; no sleep)
        ├─ diff new-version lines vs the previous pod's baseline
        ├─ classify each new line; infer business impact from errors
        └▶ post to #argocd-deploys (clean / noise+✅ / full RCA)
```

The new version emits its logs immediately on startup and every ~2s, and the promtail sidecar
batches at 100ms, so the new lines are in Loki within seconds — Holmes polls Loki rather than
waiting.

## Files

- `build.sh`, `app/` — the `checkout-api` source built into `:v1` (healthy) and `:v2` (regressed).
- `loki/loki.yaml` — minimal single-binary Loki (namespace `logging`).
- `install.sh` — installs ArgoCD + Loki + the app; `--uninstall` to tear down.
- `gitops/manifest.yaml` — the app Deployment (image tag bumped on deploy) + promtail sidecar + Service.
- `argocd/application.yaml`, `argocd/notifications.yaml` — the ArgoCD app + Holmes webhook wiring.
- `triggered-workflow-prompt.txt` — the Holmes log-analysis prompt (3 output modes).
