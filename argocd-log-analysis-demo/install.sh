#!/usr/bin/env bash
#
# One-command setup for the ArgoCD + Loki log-analysis demo.
#
# Installs (all into dedicated namespaces so nothing clashes with existing infra):
#   - ArgoCD            -> namespace argocd-demo (default)
#   - Loki              -> namespace logging
#   - the checkout app  -> namespace checkout (deployed by ArgoCD)
#
# Usage:
#   ./install.sh
#   WEBHOOK_URL="https://<holmes-triggered-workflow>" WEBHOOK_TOKEN="<token>" ./install.sh
#   ./install.sh --uninstall
#
# Override via env vars (see defaults below).
set -euo pipefail

NAMESPACE="${NAMESPACE:-argocd-demo}"
ARGOCD_VERSION="${ARGOCD_VERSION:-v3.4.4}"
REPO_URL="${REPO_URL:-https://github.com/robusta-dev/kubernetes-demos}"
LIVE_BRANCH="${LIVE_BRANCH:-argocd-log-analysis-demo-live}"
WEBHOOK_URL="${WEBHOOK_URL:-}"
WEBHOOK_TOKEN="${WEBHOOK_TOKEN:-}"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_URL="https://raw.githubusercontent.com/argoproj/argo-cd/${ARGOCD_VERSION}/manifests/install.yaml"

# --- uninstall ---------------------------------------------------------------
if [[ "${1:-}" == "--uninstall" || "${1:-}" == "uninstall" ]]; then
  echo "==> Uninstalling demo (app, Loki, ArgoCD namespace '${NAMESPACE}')"
  kubectl delete application checkout -n "${NAMESPACE}" --ignore-not-found
  kubectl delete namespace checkout --ignore-not-found
  kubectl delete namespace logging --ignore-not-found
  kubectl delete namespace "${NAMESPACE}" --ignore-not-found
  cat <<EOF

==> Done. The dedicated namespaces are gone.

ArgoCD's cluster-scoped resources were left in place (they may be shared with
another ArgoCD on this cluster). If this was the ONLY ArgoCD, remove them with:

  kubectl delete clusterrole argocd-application-controller argocd-server argocd-applicationset-controller --ignore-not-found
  kubectl delete clusterrolebinding argocd-application-controller argocd-server argocd-applicationset-controller --ignore-not-found
  kubectl delete crd applications.argoproj.io appprojects.argoproj.io applicationsets.argoproj.io --ignore-not-found
EOF
  exit 0
fi
# -----------------------------------------------------------------------------

echo "==> Installing ArgoCD ${ARGOCD_VERSION} into namespace '${NAMESPACE}'"
kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

# ArgoCD core (incl. notifications controller). Rewrite the hardcoded 'namespace: argocd'
# refs to our namespace, and use server-side apply (the ApplicationSet CRD exceeds the
# client-side annotation size limit).
curl -sSL "${INSTALL_URL}" \
  | sed "s|namespace: argocd$|namespace: ${NAMESPACE}|g" \
  | kubectl apply --server-side --force-conflicts -n "${NAMESPACE}" -f -

echo "==> Waiting for ArgoCD to become ready"
kubectl wait --for=condition=established --timeout=60s crd/applications.argoproj.io
for d in argocd-server argocd-repo-server argocd-notifications-controller; do
  kubectl rollout status "deploy/${d}" -n "${NAMESPACE}" --timeout=300s
done
kubectl rollout status statefulset/argocd-application-controller -n "${NAMESPACE}" --timeout=300s

echo "==> Installing Loki (namespace logging)"
kubectl apply -f "${DIR}/loki/loki.yaml"
kubectl rollout status deploy/loki -n logging --timeout=180s

echo "==> Deploying demo Application (repo=${REPO_URL}, branch=${LIVE_BRANCH})"
sed -e "s|__REPO_URL__|${REPO_URL}|g" \
    -e "s|__LIVE_BRANCH__|${LIVE_BRANCH}|g" \
    -e "s|namespace: argocd-demo|namespace: ${NAMESPACE}|g" \
    "${DIR}/argocd/application.yaml" | kubectl apply -f -

if [[ -n "${WEBHOOK_URL}" && -n "${WEBHOOK_TOKEN}" ]]; then
  echo "==> Applying Holmes notification wiring"
  sed -e "s|__WEBHOOK_URL__|${WEBHOOK_URL}|g" \
      -e "s|__WEBHOOK_TOKEN__|${WEBHOOK_TOKEN}|g" \
      -e "s|namespace: argocd-demo|namespace: ${NAMESPACE}|g" \
      "${DIR}/argocd/notifications.yaml" | kubectl apply -f -
else
  echo "==> Skipping notification wiring (set WEBHOOK_URL and WEBHOOK_TOKEN to enable)"
fi

cat <<EOF

==> Done. Confirm with:

  kubectl get pods -n ${NAMESPACE}
  kubectl get pods -n logging
  kubectl get applications -n ${NAMESPACE} checkout
  kubectl get pods -n checkout

Point HolmesGPT's grafana/loki toolset at:  http://loki.logging:3100
(and disable the kubernetes/logs toolset so Holmes uses Loki for history).

ArgoCD UI (optional):
  kubectl -n ${NAMESPACE} get secret argocd-initial-admin-secret -o jsonpath='{.data.password}'; echo
  kubectl port-forward svc/argocd-server -n ${NAMESPACE} 8080:443   # https://localhost:8080 (user: admin)
EOF
