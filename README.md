# Introduction 
Practice Kubernetes troubleshooting with example scenarios.

Evaluate observability platforms, like [Robusta.dev](https://home.robusta.dev/), by testing them out on realistic Kubernetes errors.

# Usage
Run various `kubectl apply` commands. To cleanup, run `kubectl delete` on the same.

# Scenarios

## Pod Issues

### Crashing Pod (CrashLoopBackoff)

```
kubectl apply -f https://raw.githubusercontent.com/robusta-dev/kubernetes-demos/main/crashpod/broken.yaml
```

### OOMKilled Pod (Out of Memory Kill)

```
kubectl apply -f https://raw.githubusercontent.com/robusta-dev/kubernetes-demos/main/oomkill/oomkill_job.yaml
```

### High CPU Throttling (CPUThrottlingHigh)

Apply the following YAML and wait **15 minutes**. (CPU throttling is only an issue if it occurs for a meangingful periods of time. Less than 15 minutes of throttling typically does not trigger an alert.)

```
kubectl apply -f https://raw.githubusercontent.com/robusta-dev/kubernetes-demos/main/cpu_throttling/throttling.yaml
```

### Pending Pod

Apply the following YAML and wait **15 minutes**. (By default, most systems only alert after pods are pending for 15 minutes. This prevents false alarms on autoscaled clusters, where its OK for pods to be temporarily pending.)

```
kubectl apply -f https://raw.githubusercontent.com/robusta-dev/kubernetes-demos/main/pending_pods/pending_pod.yaml
```

### ImagePullBackOff

```
kubectl apply -f https://raw.githubusercontent.com/robusta-dev/kubernetes-demos/main/image_pull_backoff/no_such_image.yaml
```

## Change Tracking

Deploy a healthy pod. Then break it.

```
kubectl apply -f https://raw.githubusercontent.com/robusta-dev/kubernetes-demos/main/crashpod/healthy.yaml
kubectl apply -f https://raw.githubusercontent.com/robusta-dev/kubernetes-demos/main/crashpod/broken.yaml
```

Now audit your cluster. If someone else made this change, would you be able to pinpoint the change that broke the application?

## Drift and Namespace Comparison

```
kubectl apply -f https://raw.githubusercontent.com/robusta-dev/kubernetes-demos/main/namespace_drift/example.yaml
```

Can you quickly tell the difference between the `compare1` and `compare2` namespaces? What is the drift between them?
