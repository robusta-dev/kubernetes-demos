#!/usr/bin/env bash
#
# One-command install of a self-contained ArgoCD for this demo.
#
# Installs ArgoCD into its OWN namespace (default: argocd-demo) so it never
# clashes with an existing ArgoCD in the cluster, then deploys the demo
# Application (and, if a webhook is provided, the Holmes notification wiring).
#
# Usage:
#   ./install-argocd.sh
#
# Override any of these via environment variables:
#   NAMESPACE        namespace to install ArgoCD into        (default: argocd-demo)
#   ARGOCD_VERSION   pinned ArgoCD release to install        (default: v3.4.4)
#   REPO_URL         git repo ArgoCD syncs from              (default: this public repo)
#   LIVE_BRANCH      branch ArgoCD tracks (NOT main)         (default: argocd-regression-demo-live)
#   WEBHOOK_URL      Holmes Triggered Workflow endpoint      (optional)
#   WEBHOOK_TOKEN    auth token for that endpoint            (optional)
#
# If WEBHOOK_URL and WEBHOOK_TOKEN are both set, the notification wiring is
# applied; otherwise it is skipped (you can apply it later).
set -euo pipefail

NAMESPACE="${NAMESPACE:-argocd-demo}"
ARGOCD_VERSION="${ARGOCD_VERSION:-v3.4.4}"
REPO_URL="${REPO_URL:-https://github.com/robusta-dev/kubernetes-demos}"
LIVE_BRANCH="${LIVE_BRANCH:-argocd-regression-demo-live}"
WEBHOOK_URL="${WEBHOOK_URL:-}"
WEBHOOK_TOKEN="${WEBHOOK_TOKEN:-}"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_URL="https://raw.githubusercontent.com/argoproj/argo-cd/${ARGOCD_VERSION}/manifests/install.yaml"

echo "==> Installing ArgoCD ${ARGOCD_VERSION} into namespace '${NAMESPACE}'"

# 1. namespace (idempotent)
kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

# 2. ArgoCD core (incl. notifications controller). The upstream manifest hardcodes
#    'namespace: argocd' in its ClusterRoleBinding/RoleBinding subjects, so rewrite
#    it to our namespace before applying.
echo "==> Applying ArgoCD manifests"
curl -sSL "${INSTALL_URL}" \
  | sed "s|namespace: argocd$|namespace: ${NAMESPACE}|g" \
  | kubectl apply -n "${NAMESPACE}" -f -

# 3. wait for the CRDs and the controllers to be ready
echo "==> Waiting for ArgoCD to become ready"
kubectl wait --for=condition=established --timeout=60s crd/applications.argoproj.io
for d in argocd-server argocd-repo-server argocd-notifications-controller; do
  kubectl rollout status "deploy/${d}" -n "${NAMESPACE}" --timeout=300s
done
kubectl rollout status statefulset/argocd-application-controller -n "${NAMESPACE}" --timeout=300s

# 4. deploy the demo Application (substitute placeholders + namespace)
echo "==> Deploying demo Application (repo=${REPO_URL}, branch=${LIVE_BRANCH})"
sed -e "s|__REPO_URL__|${REPO_URL}|g" \
    -e "s|__LIVE_BRANCH__|${LIVE_BRANCH}|g" \
    -e "s|namespace: argocd-demo|namespace: ${NAMESPACE}|g" \
    "${DIR}/argocd/application.yaml" | kubectl apply -f -

# 5. notification wiring (only if a webhook was provided)
if [[ -n "${WEBHOOK_URL}" && -n "${WEBHOOK_TOKEN}" ]]; then
  echo "==> Applying Holmes notification wiring"
  sed -e "s|__WEBHOOK_URL__|${WEBHOOK_URL}|g" \
      -e "s|__WEBHOOK_TOKEN__|${WEBHOOK_TOKEN}|g" \
      -e "s|namespace: argocd-demo|namespace: ${NAMESPACE}|g" \
      "${DIR}/argocd/notifications.yaml" | kubectl apply -f -
else
  echo "==> Skipping notification wiring (set WEBHOOK_URL and WEBHOOK_TOKEN to enable)"
fi

# 6. confirmation
cat <<EOF

==> Done. Confirm with:

  kubectl get pods -n ${NAMESPACE}
  kubectl get applications -n ${NAMESPACE} storefront
  kubectl get pods -n storefront

Open the ArgoCD UI (optional):

  admin password:
    kubectl -n ${NAMESPACE} get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d; echo
  port-forward:
    kubectl port-forward svc/argocd-server -n ${NAMESPACE} 8080:443
  then browse https://localhost:8080  (user: admin)
EOF
