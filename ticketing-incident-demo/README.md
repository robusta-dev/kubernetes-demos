# Ticketing platform — incident.io / Holmes first-responder demo

A small, realistic microservices environment for demoing **HolmesGPT as the first
responder** in an incident.io workflow.

## Scenario

We are a ticketing company. The platform has three services that share one
PostgreSQL database:

```
seat-selection ─┐
booking ────────┼──▶  ticketing-db (PostgreSQL)
payment ────────┘
```

The `seat-selection` service was updated and the new revision shipped with a
**wrong database host** (`DB_HOST: ticketing-db-prod`, which does not resolve).
On startup the service cannot reach the database, so it **crash-loops**
(`CrashLoopBackOff` → `KubePodCrashLooping`). `booking` and `payment` use the
correct host and stay healthy.

Because `seat-selection` is on the purchase critical path, **no customer can pick
a seat or buy a ticket** — a low-severity alert that is actually an urgent,
revenue-impacting incident.

## How Holmes finds the root cause (no prior knowledge of the env)

Everything Holmes needs is in-cluster:

1. **Logs** — `kubectl logs deploy/seat-selection -n ticketing` shows a real
   PostgreSQL error naming the bad host
   (`could not translate host name "ticketing-db-prod" to address`) ending in a
   `FATAL` line.
2. **Deployment spec** — `kubectl get deploy seat-selection -n ticketing -o yaml`
   shows `DB_HOST: ticketing-db-prod`.
3. **Healthy siblings as a diff** — `booking` and `payment` use `DB_HOST:
   ticketing-db`, so the discrepancy is obvious.
4. **Business impact** — descriptive names + labels (`business-criticality:
   tier-1`, `app.kubernetes.io/part-of: ticketing-platform`, `team: checkout`)
   let Holmes infer the revenue impact and escalate to Urgent.

The fix is a one-line change Holmes can open as a PR: in `manifest.yaml`, change
the `seat-selection` container's `DB_HOST` from `ticketing-db-prod` to
`ticketing-db`.

## Deploying

The container image is prebuilt. Just apply the manifest:

```
kubectl apply -f https://raw.githubusercontent.com/robusta-dev/kubernetes-demos/main/ticketing-incident-demo/manifest.yaml
```

Verify:

```
kubectl get pods -n ticketing
# seat-selection-*   CrashLoopBackOff
# booking-*          Running
# payment-*          Running
# ticketing-db-*     Running
```

Cleanup:

```
kubectl delete -f https://raw.githubusercontent.com/robusta-dev/kubernetes-demos/main/ticketing-incident-demo/manifest.yaml
```

## Firing the alert (Stage #3)

See [`grafana-test-alert.md`](./grafana-test-alert.md) for the exact Summary,
Description, Labels, and Runbook URL to paste into Grafana's **Test contact
point**, which creates the incident in incident.io.

## Building the image (maintainers)

```
./build.sh   # builds + pushes us-central1-docker.pkg.dev/genuine-flight-317411/devel/ticketing-service:v1
```

The same image runs all three roles; the role is chosen by the `SERVICE_NAME`
environment variable (`seat-selection` | `booking` | `payment`).

## Reskinning to another business flavor

The failure mechanism (bad `DB_HOST` env var → crash loop) is identical for every
flavor — only the names, labels, and alert text change. To reskin, rename the
services and database in `manifest.yaml` and update `grafana-test-alert.md`:

| Flavor       | Crashing service | Other services        | Database     | Impact when crashing            |
|--------------|------------------|-----------------------|--------------|---------------------------------|
| Ticketing    | `seat-selection` | `booking`, `payment`  | `ticketing-db` | Customers can't buy tickets     |
| E-commerce   | `checkout`       | `cart`, `catalog`     | `orders-db`    | Customers can't complete orders |
| Banking      | `transfers`      | `accounts`, `ledger`  | `ledger-db`    | Customers can't move money      |
