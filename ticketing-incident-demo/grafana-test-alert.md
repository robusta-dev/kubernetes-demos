# Stage #3 — Grafana "Test contact point" payload

Use this to fire a realistic `KubePodCrashLooping` alert at the incident.io contact
point **without** waiting for a real CrashLoopBackOff alert to fire. It mimics the
alert that `kube-prometheus-stack` emits for the broken `seat-selection` pod as
closely as possible.

## Option A — Grafana UI (recommended)

In Grafana: **Alerting → Contact points → (your incident.io contact point) → Test**.
Choose **Custom** and fill in the annotations and labels below.

### Labels

| Key                | Value                                  |
|--------------------|----------------------------------------|
| `alertname`        | `KubePodCrashLooping`                  |
| `severity`         | `low`                                  |
| `namespace`        | `ticketing`                            |
| `pod`              | `seat-selection-7d9c8c6b4f-x2k9p`      |
| `container`        | `seat-selection`                       |
| `reason`           | `CrashLoopBackOff`                     |
| `job`              | `kube-state-metrics`                   |
| `cluster`          | `prod-us-central1`                     |

> Note: real `KubePodCrashLooping` defaults to `severity: warning`. The ticket
> scenario intentionally starts at `severity: low` so that Holmes is the one to
> recognize the real (Urgent) business impact and escalate.

### Annotations

| Key           | Value                                                                                               |
|---------------|-----------------------------------------------------------------------------------------------------|
| `summary`     | `Pod is crash looping.`                                                                              |
| `description` | `Pod ticketing/seat-selection-7d9c8c6b4f-x2k9p (seat-selection) is in waiting state (reason: "CrashLoopBackOff").` |
| `runbook_url` | `https://runbooks.prometheus-operator.dev/runbooks/kubernetes/kubepodcrashlooping`                  |

## Option B — Raw webhook body (fallback)

If you test the webhook directly instead of via Grafana's UI, this is the
Grafana-style alert payload to POST:

```json
{
  "receiver": "incident-io",
  "status": "firing",
  "alerts": [
    {
      "status": "firing",
      "labels": {
        "alertname": "KubePodCrashLooping",
        "severity": "low",
        "namespace": "ticketing",
        "pod": "seat-selection-7d9c8c6b4f-x2k9p",
        "container": "seat-selection",
        "reason": "CrashLoopBackOff",
        "job": "kube-state-metrics",
        "cluster": "prod-us-central1"
      },
      "annotations": {
        "summary": "Pod is crash looping.",
        "description": "Pod ticketing/seat-selection-7d9c8c6b4f-x2k9p (seat-selection) is in waiting state (reason: \"CrashLoopBackOff\").",
        "runbook_url": "https://runbooks.prometheus-operator.dev/runbooks/kubernetes/kubepodcrashlooping"
      },
      "startsAt": "2026-06-22T09:00:00Z",
      "generatorURL": "https://grafana.example.com/alerting/grafana/kubepodcrashlooping"
    }
  ],
  "groupLabels": {
    "alertname": "KubePodCrashLooping",
    "namespace": "ticketing"
  },
  "commonLabels": {
    "alertname": "KubePodCrashLooping",
    "severity": "low",
    "namespace": "ticketing",
    "pod": "seat-selection-7d9c8c6b4f-x2k9p"
  },
  "commonAnnotations": {
    "summary": "Pod is crash looping."
  },
  "externalURL": "https://grafana.example.com"
}
```

## Expected result

A new incident is created in incident.io in **Triage** status. The incident.io
workflow adds the `holmes-staging` bot to the incident channel, which triggers
Holmes to investigate the `seat-selection` pod in the `ticketing` namespace.
