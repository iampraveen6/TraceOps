# TraceOps
TraceOps is a lightweight, end-to-end observability stack for a Node.js microservice on Kubernetes using Docker Desktop + Helm.

## Overview

- Microservice: Node.js (Express) with OpenTelemetry auto-instrumentation and custom spans/logging
- Collector: OpenTelemetry Collector (OTLP in, Jaeger out, Prometheus metrics out)
- Storage/Visualization: Prometheus + Grafana for metrics, Jaeger for traces
- CI: GitHub Actions builds/pushes Docker image

DockerHub username used in examples: `iampraveen6`.

---

## Quick Start (Docker Desktop Kubernetes + Helm)

```bash
# 1) Ensure Docker Desktop is running with Kubernetes enabled
#    (Settings → Kubernetes → Enable Kubernetes)

# 2) Switch kubectl context to Docker Desktop
kubectl config use-context docker-desktop

# 3) Build the app image locally (Docker Desktop K8s shares the Docker daemon)
docker build -t traceops-app:latest ./app

# 4) Install/upgrade the full stack with Helm
helm upgrade --install traceops ./helm/traceops \
  --namespace traceops \
  --create-namespace

# 5) Port-forward UIs
kubectl port-forward -n traceops svc/traceops-app 8080:8080 & \
kubectl port-forward -n traceops svc/grafana 3000:3000 & \
kubectl port-forward -n traceops svc/prometheus 9090:9090 & \
kubectl port-forward -n traceops svc/jaeger 16686:16686 &

# 6) Test
curl http://localhost:8080/
curl http://localhost:8080/error
```

Notes:
- `imagePullPolicy: Never` is the default in `helm/traceops/values.yaml` so local images work without a registry.
- To use a DockerHub image instead, set:
  ```bash
  helm upgrade --install traceops ./helm/traceops \
    --namespace traceops \
    --create-namespace \
    --set app.image.repository=iampraveen6/traceops-app \
    --set app.image.tag=latest \
    --set imagePullPolicy=IfNotPresent
  ```
- The raw YAML files in `k8s/` are available if you prefer `kubectl apply` instead of Helm.

---

## Architecture

```mermaid
graph LR
  Client[(User/Client)] -->|HTTP :8080| App[traceops-app (Express)]
  App -->|OTLP gRPC :4317| Otel[OpenTelemetry Collector]
  Otel -->|thrift_http :14268| Jaeger[Jaeger All-in-One]
  Otel -->|Prometheus Exporter :8889| Prom[Prometheus]
  Grafana[Grafana] -->|Prometheus datasource| Prom
```

ASCII fallback:

```
Client --> (HTTP :8080) --> traceops-app (Express)
traceops-app --(OTLP gRPC :4317)--> OTel Collector
OTel Collector --(thrift_http :14268)--> Jaeger (UI :16686)
OTel Collector --(Prometheus exporter :8889)--> Prometheus (UI :9090)
Grafana (UI :3000) --(datasource)--> Prometheus
```

Notes:
- Namespace: `traceops`
- App exports traces/metrics to Collector; Collector fan-outs to Jaeger and Prometheus.

---

## Repository Structure

```
app/
k8s/
helm/
  traceops/
    Chart.yaml
    values.yaml
    templates/
.github/workflows/
```

---

## Step-by-Step Guide

Follow these steps in order to implement and run the full TraceOps observability stack on Docker Desktop Kubernetes.

**All files referenced in this guide exist in the repository.**

### Files Used by This Guide

App:
- `app/Dockerfile`
- `app/package.json`
- `app/.dockerignore`
- `app/src/index.js`
- `app/src/logger.js`
- `app/src/tracing.js`

Helm chart (recommended deployment path):
- `helm/traceops/.helmignore`
- `helm/traceops/Chart.yaml`
- `helm/traceops/values.yaml`
- `helm/traceops/templates/_helpers.tpl`
- `helm/traceops/templates/namespace.yaml`
- `helm/traceops/templates/app.yaml`
- `helm/traceops/templates/otel-collector.yaml`
- `helm/traceops/templates/jaeger.yaml`
- `helm/traceops/templates/prometheus.yaml`
- `helm/traceops/templates/grafana.yaml`

Raw Kubernetes manifests (alternative / ArgoCD source):
- `k8s/namespace.yaml`
- `k8s/otel-collector-config.yaml`
- `k8s/otel-collector-deployment.yaml`
- `k8s/jaeger.yaml`
- `k8s/prometheus-configmap.yaml`
- `k8s/prometheus-deployment.yaml`
- `k8s/grafana-configmap.yaml`
- `k8s/grafana-deployment.yaml`
- `k8s/app-deployment.yaml`
- `k8s/argocd-application.yaml` (ArgoCD only)

CI:
- `.github/workflows/docker.yml`

### 1. Prerequisites

- Docker Desktop installed with Kubernetes enabled  
  (Settings → Kubernetes → check "Enable Kubernetes")
- `kubectl` and `Helm` installed

Install kubectl (if not already present):

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo update-ca-certificates
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
kubectl version --client
```

Install Helm:

```bash
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
helm version
```

### 2. Verify Docker Desktop Kubernetes

```bash
kubectl config use-context docker-desktop
kubectl get nodes
```

You should see a single node (e.g. `docker-desktop`).

### 3. Build the Application Image

Build locally for Docker Desktop (shares the Docker daemon):

```bash
docker build -t traceops-app:latest ./app
```

Verify:

```bash
docker images | grep traceops-app
```

### 4. Deploy the Observability Stack

**Option A – Recommended: Helm (uses `helm/traceops/`)**

```bash
helm upgrade --install traceops ./helm/traceops \
  --namespace traceops \
  --create-namespace

helm list -n traceops
kubectl get pods -n traceops
```

**Option B – Raw YAML manifests (uses `k8s/` directory)**

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/otel-collector-config.yaml
kubectl apply -f k8s/otel-collector-deployment.yaml
kubectl apply -f k8s/jaeger.yaml
kubectl apply -f k8s/prometheus-configmap.yaml
kubectl apply -f k8s/prometheus-deployment.yaml
kubectl apply -f k8s/grafana-configmap.yaml
kubectl apply -f k8s/grafana-deployment.yaml
kubectl apply -f k8s/app-deployment.yaml
```

Check readiness:

```bash
kubectl get pods -n traceops
```

Wait until all pods show `Running` and `1/1`.

### 5. Access the Services (Port-Forward)

```bash
kubectl port-forward -n traceops svc/traceops-app 8080:8080 &
kubectl port-forward -n traceops svc/grafana 3000:3000 &
kubectl port-forward -n traceops svc/prometheus 9090:9090 &
kubectl port-forward -n traceops svc/jaeger 16686:16686 &
```

UIs:
- App: http://localhost:8080
- Grafana: http://localhost:3000 (admin / admin)
- Prometheus: http://localhost:9090
- Jaeger: http://localhost:16686

### 6. Validate the Stack

Generate traffic:

```bash
curl http://localhost:8080/
curl http://localhost:8080/error
```

Verify traces:
- Open Jaeger UI → select service `traceops-app` → Find Traces

Verify metrics:
- Prometheus → Graph → query `http_requests_total`
- Grafana → Add panel → Prometheus datasource → query `http_requests_total`

### 7. (Optional) GitOps with ArgoCD

See the dedicated section below: "## ArgoCD (GitOps) – optional"

It uses the raw manifests in `k8s/` and the Application definition at `k8s/argocd-application.yaml`.

### 8. (Optional) CI/CD with GitHub Actions

See the dedicated section below: "## GitHub Actions CI (Docker build/push)"

Workflow file: `.github/workflows/docker.yml`

### 9. You Are Done

At this point you have implemented the complete TraceOps stack using all project files:

- Application code + Dockerfile in `app/`
- Helm chart (recommended path) in `helm/traceops/`
- Raw Kubernetes manifests in `k8s/` (including `argocd-application.yaml` for GitOps)
- CI workflow in `.github/workflows/docker.yml`

Proceed to the sections below for GitHub Actions CI and optional ArgoCD GitOps, or use the Quick Start / Cleanup as needed.

---

## GitHub Actions CI (Docker build/push)

Workflow: `.github/workflows/docker.yml`

Set GitHub repository secrets:

- `DOCKERHUB_USERNAME` = `iampraveen6`
- `DOCKERHUB_TOKEN` = DockerHub access token (PAT)

On push to `main` or tags `v*`, CI builds `./app` and pushes:

- `iampraveen6/traceops-app:latest`
- `iampraveen6/traceops-app:${GITHUB_SHA}`

To deploy that image via YAML, set in `k8s/app-deployment.yaml` as shown above and apply.

---

## ArgoCD (GitOps) – optional

Install ArgoCD in-cluster:

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl get pods -n argocd
```

Port-forward UI and login:

```bash
kubectl port-forward -n argocd svc/argocd-server 8081:443
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d; echo
argocd login localhost:8081 --username admin --password <printed-password> --insecure
```

Set your repo URL in `k8s/argocd-application.yaml`:

```yaml
spec:
  source:
    repoURL: https://github.com/<your-username>/TraceOps.git
    targetRevision: main
    path: k8s
```

Apply the Application:

```bash
kubectl apply -f k8s/argocd-application.yaml
```

ArgoCD is set to auto-sync and self-heal.

---

## Low-resource Tuning (already applied)

- Single replica for all components.
- App sampling: `parentbased_traceidratio` at 10%.
- App metric export interval: 30s.
- Prometheus: 30s scrape, 24h/256MB retention, lower query samples.
- Small resource requests/limits for Collector/Prometheus/Grafana/Jaeger/App.

Optional extra cuts:

- Lower sampling further: set `OTEL_TRACES_SAMPLER_ARG` to `0.05` or `0.01` in `helm/traceops/values.yaml` under `app.env`.
- Slow scrape more: set `scrapeInterval` to `45s` or `60s` in `helm/traceops/values.yaml` under `prometheus`.
- Limit Node memory: add `NODE_OPTIONS=--max-old-space-size=128` to app env in values.

---

## Troubleshooting

- Docker not running: start Docker Desktop; ensure Kubernetes is enabled in Settings → Kubernetes.
- Image not found / ErrImageNeverPull: you built with a different tag or context. Run `docker images | grep traceops-app` and ensure the image is `traceops-app:latest`. Rebuild: `docker build -t traceops-app:latest ./app`.
- Pods not ready: `kubectl get pods -n traceops`; `kubectl describe pod -n traceops <pod>`.
- No traces: check `kubectl logs -n traceops deploy/otel-collector`; verify app env `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317`.
- No metrics: port-forward Collector metrics `kubectl port-forward -n traceops svc/otel-collector 8889:8889` then `curl http://localhost:8889/metrics`.
- OOM / high memory: reduce sampling in values (`app.env.OTEL_TRACES_SAMPLER_ARG: "0.05"`), lower Prometheus retention, or increase Docker Desktop memory.

### Helm install script fails with SSL (curl 60) behind corporate proxy

Symptom:
- `curl: (60) SSL certificate problem: self-signed certificate in certificate chain` when running `get-helm-3`.

Fix options:
- Trust corporate root CA in WSL:
  ```bash
  # Export corporate root CA from Windows as Base-64 .cer
  sudo cp /mnt/c/Users/<you>/Downloads/CorpRootCA.cer /usr/local/share/ca-certificates/corp-root.crt
  sudo update-ca-certificates
  curl -I https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
  curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
  ```
- Or install Helm on Windows (PowerShell) and use it from Windows:
  ```powershell
  choco install kubernetes-helm -y
  helm version
  ```
- Temporary workaround: deploy with raw YAMLs from `k8s/` instead of Helm until CA is trusted.
- If on a proxy, export env vars in WSL before curl:
  ```bash
  export HTTPS_PROXY=http://user:pass@proxy-host:port
  export HTTP_PROXY=http://user:pass@proxy-host:port
  export NO_PROXY=localhost,127.0.0.1,.svc,.cluster.local
  ```

### Collector CrashLoopBackOff: deprecated `logging` exporter

Symptom:
- Collector logs: `'exporters' the logging exporter has been deprecated, use the debug exporter instead`.

Fix:
- Edit `k8s/otel-collector-config.yaml` exporters to replace `logging` with `debug` and update traces pipeline exporters.
  ```yaml
  exporters:
    debug:
    zipkin:
      endpoint: http://jaeger.traceops.svc.cluster.local:9411/api/v2/spans

  service:
    pipelines:
      traces:
        receivers: [otlp]
        processors: [batch]
        exporters: [zipkin, debug]
  ```
- Apply and restart:
  ```bash
  kubectl apply -f k8s/otel-collector-config.yaml
  kubectl rollout restart deployment/otel-collector -n traceops
  kubectl logs -n traceops deploy/otel-collector --tail=100
  ```

### Collector error: unknown exporter type `jaeger` or connection refused to `jaeger:4317`

Cause:
- Recent collector images don’t include a `jaeger` exporter. Use `zipkin` or `otlp` instead.
- If exporting OTLP to Jaeger, ensure Jaeger exposes OTLP and the port is open.

Fix (Zipkin path recommended):
- Enable Zipkin and OTLP on Jaeger and expose ports:
  ```yaml
  # k8s/jaeger.yaml (Deployment args)
  args: ["--memory.max-traces=2000", "--collector.otlp.enabled=true", "--collector.zipkin.host-port=:9411"]

  # k8s/jaeger.yaml (Service ports)
  - name: otlp-grpc
    port: 4317
    targetPort: 4317
  - name: zipkin
    port: 9411
    targetPort: 9411
  ```
- Ensure Collector receives on all interfaces:
  ```yaml
  receivers:
    otlp:
      protocols:
        grpc:
          endpoint: 0.0.0.0:4317
        http:
          endpoint: 0.0.0.0:4318
  ```
- Apply and restart Jaeger + Collector:
  ```bash
  kubectl apply -f k8s/jaeger.yaml
  kubectl apply -f k8s/otel-collector-config.yaml
  kubectl rollout restart deployment/jaeger -n traceops
  kubectl rollout restart deployment/otel-collector -n traceops
  ```

### App CrashLoopBackOff: `TypeError: Cannot read properties of undefined (reading 'then')` in `tracing.js`

Cause:
- In `@opentelemetry/sdk-node` v0.52.0, `NodeSDK.start()` is sync (returns void). Chaining `.then()` causes a crash.

Fix:
- Update `app/src/tracing.js` to use try/catch and async shutdown:
  ```js
  try {
    sdk.start();
    console.log("OpenTelemetry initialized");
    process.on("SIGTERM", async () => {
      try { await sdk.shutdown(); process.exit(0); } catch { process.exit(1); }
    });
  } catch (err) {
    console.error("Error starting OpenTelemetry", err);
  }
  ```
- Rebuild and restart app:
  ```bash
  docker build -t traceops-app:latest ./app
  kubectl delete pod -n traceops -l app=traceops-app
  ```

### Grafana page not loading on 3000 (port already in use)

Symptom:
- `kubectl port-forward ... 3000:3000` → `address already in use`.
- `sudo ss -lntp | grep ':3000'` shows `docker-proxy` holding 0.0.0.0:3000.

Fix options:
- Free only the docker-proxy PIDs then reattach port-forward:
  ```bash
  PIDS=$(sudo ss -lntp | awk '/:3000/ && /docker-proxy/ {print $NF}' | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u)
  echo "$PIDS" | xargs -r sudo kill || true
  sleep 1; echo "$PIDS" | xargs -r sudo kill -9 || true
  nohup kubectl port-forward -n traceops svc/grafana 3000:3000 > /tmp/pf-grafana.log 2>&1 &
  curl -sfI http://localhost:3000/login || echo "grafana not ready"
  ```
- Or find and stop the container publishing 3000, or restart Docker Desktop if proxies persist.

---

## Cleanup

```bash
helm uninstall traceops -n traceops || true
kubectl delete namespace traceops || true
kubectl delete namespace argocd || true
```

---

## License

MIT
