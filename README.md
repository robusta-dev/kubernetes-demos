# Introduction 
Practice Kubernetes troubleshooting with realistic error scenarios.

Each scenario is run with `kubectl apply` commands. To cleanup, run `kubectl delete` on the same.

# Simple Scenarios

<details>
<summary>Crashing Pod (CrashLoopBackoff)</summary>
```
kubectl apply -f https://raw.githubusercontent.com/robusta-dev/kubernetes-demos/main/crashpod/broken.yaml
```

To get notifications like below, install [Robusta](https://github.com/robusta-dev/robusta):
<img width="500" src="./example_images/crashingpod.png">
</details>


<details>
<summary>OOMKilled Pod (Out of Memory Kill)</summary>
```
kubectl apply -f https://raw.githubusercontent.com/robusta-dev/kubernetes-demos/main/oomkill/oomkill_job.yaml
```

To get notifications like below, install [Robusta](https://github.com/robusta-dev/robusta):
<img width="500" src="./example_images/oomkillpod.png">
</details>


<details>
<summary>High CPU Throttling (CPUThrottlingHigh)</summary>
Apply the following YAML and wait **15 minutes**. (CPU throttling is only an issue if it occurs for a meaningful period of time. Less than 15 minutes of throttling typically does not trigger an alert.)
```
kubectl apply -f https://raw.githubusercontent.com/robusta-dev/kubernetes-demos/main/cpu_throttling/throttling.yaml
```

To get notifications like below, install [Robusta](https://github.com/robusta-dev/robusta):
<img width="500" src="./example_images/highcputhrottling.png"> 
</details>


<details>
<summary>Pending Pod (Unschedulable due to Node Selectors)</summary>
Apply the following YAML and wait **15 minutes**. (By default, most systems only alert after pods are pending for 15 minutes. This prevents false alarms on autoscaled clusters, where it's OK for pods to be temporarily pending.)

```
kubectl apply -f https://raw.githubusercontent.com/robusta-dev/kubernetes-demos/main/pending_pods/pending_pod_node_selector.yaml
```

To get notifications like below, install [Robusta](https://github.com/robusta-dev/robusta):
<img width="500" src="./example_images/pendingpod.png">
</details>


<details>
<summary>ImagePullBackOff</summary>
```
kubectl apply -f https://raw.githubusercontent.com/robusta-dev/kubernetes-demos/main/image_pull_backoff/no_such_image.yaml 
```

To get notifications like below, install [Robusta](https://github.com/robusta-dev/robusta):
<img width="500" src="./example_images/imagepullbackoff.png">
</details>


<details>
<summary>Liveness Probe Failure</summary>
```
kubectl apply -f https://raw.githubusercontent.com/robusta-dev/kubernetes-demos/main/liveness_probe_fail/failing_liveness_probe.yaml
```

To get notifications like below, install [Robusta](https://github.com/robusta-dev/robusta):
<img width="500" src="./example_images/failedlivenessprobe.png">
</details>


<details>
<summary>Job Failure</summary>
The job will fail after 60 seconds, then attempt to run again. After two attempts, it will fail for good.
```
kubectl apply -f https://raw.githubusercontent.com/robusta-dev/kubernetes-demos/main/job_failure/job_crash.yaml
```

To get notifications like below, install [Robusta](https://github.com/robusta-dev/robusta):
<img width="500" src="./example_images/failingjobs.png">
</details>


<details>
<summary>Failed Helm Releases</summary>
Deliberately deploy a failing Helm release:

```shell
helm repo add robusta https://robusta-charts.storage.googleapis.com && helm repo update
helm install kubewatch robusta/kubewatch --set='rbac.create=true,updateStrategy.type=Error' --namespace demo-namespace
```

Upgrade the release so it succeeds:
```shell
helm upgrade kubewatch robusta/kubewatch --set='rbac.create=true' --namespace demo-namespace --create-namespace
```

Clean up by removing the release and deleting the namespace:
```shell
helm del kubewatch  --namespace demo-namespace 
kubectl delete namespace demo-namespace 
```

To get notifications like below, install [Robusta](https://github.com/robusta-dev/robusta) and setup [Helm Releases Monitoring](https://docs.robusta.dev/master/playbook-reference/triggers/helm-releases-monitoring.html) 
<img width="500" src="./example_images/helm_monitoring_kubewatch.png">
</details>


# Advanced Scenarios

<details>
<summary>Correlate Changes and Errors</summary>

Deploy a healthy pod. Then break it. 

```shell
kubectl apply -f https://raw.githubusercontent.com/robusta-dev/kubernetes-demos/main/crashpod/healthy.yaml
kubectl apply -f https://raw.githubusercontent.com/robusta-dev/kubernetes-demos/main/crashpod/broken.yaml
```
If someone else made this change, would you be able to immediately pinpoint the change that broke the application?

To get notifications like below, install [Robusta](https://github.com/robusta-dev/robusta).

<img width="500" src="./example_images/changetracking.png">
</details>

<details>
<summary>Get Notified on New Deployments</summary>
Create an nginx deployment. Then change the image tag to simulate an unexpected image tag change.

```shell
kubectl apply -f https://raw.githubusercontent.com/robusta-dev/kubernetes-demos/main/deployment_image_change/before_image_change.yaml
kubectl apply -f https://raw.githubusercontent.com/robusta-dev/kubernetes-demos/main/deployment_image_change/after_image_change.yaml
```

To get notifications like below, install [Robusta](https://github.com/robusta-dev/robusta) and [setup Kubernetes change tracking](https://docs.robusta.dev/master/tutorials/playbook-track-changes.html)

<img width="500" src="./example_images/deployment-image-change.png">
</details>


<details>
<summary>Track Ingress Changes</summary>
Create an ingress. Then changes its port and path to simulate an unexpected ingress modification.

```shell
kubectl apply -f https://raw.githubusercontent.com/robusta-dev/kubernetes-demos/main/ingress_port_path_change/before_port_path_change.yaml
kubectl apply -f https://raw.githubusercontent.com/robusta-dev/kubernetes-demos/main/ingress_port_path_change/after_port_path_change.yaml
```

To get notifications like below, install [Robusta](https://github.com/robusta-dev/robusta) and [setup Kubernetes change tracking](https://docs.robusta.dev/master/tutorials/playbook-track-changes.html)

<img width="500" src="./example_images/ingress-image-change.png">
</details>


<details>
<summary>Drift Detection and Namespace Diff</summary>
Deploy two variants of the same application in different namespaces:

```shell
kubectl apply -f https://raw.githubusercontent.com/robusta-dev/kubernetes-demos/main/namespace_drift/example.yaml
```

Can you quickly tell the difference between the `compare1` and `compare2` namespaces? What is the drift between them?

To do so with Robusta, install [Robusta](https://github.com/robusta-dev/robusta) and enable the UI.


<img width="500" src="./example_images/driftandnamespace.png">
</details>


<details>
<summary>Inefficient GKE Nodes</summary>
On GKE, nodes can reserve more than 50% of CPU for themselves. Users pay for CPU that is unavailable to applications.

Reproduction:

1. Create a default GKE cluster with autopilot disabled. Don't change any other settings.
2. Deploy the following pod:

```
kubectl apply -f https://raw.githubusercontent.com/robusta-dev/kubernetes-demos/main/gke_node_allocatable/gke_issue.yaml
```

3. Run `kubectl get pods -o wide gke-node-allocatable-issue`

The pod will be Pending. **A Pod requesting 1 CPU cannot run on an empty node with 2 CPUs!**

To see problems like this with Robusta, install [Robusta](https://github.com/robusta-dev/robusta) and enable the UI.

<img width="500" src="./example_images/highoverhead.png">
</details>

