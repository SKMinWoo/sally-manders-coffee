# 8. The shop on Kubernetes: kind in CI, synced by Argo CD from a Helm chart

Date: 2026-11-16 · Status: accepted

## Context

Exhibit 4 (numbered 11 when this was written) stands in for GM's migration of 15+ microservices to Azure Kubernetes Service, deployed
with Argo CD and Helm, which put them behind one origin with no CORS workarounds. The shop is one
Next.js app on Vercel, and production stays there. The exhibit has to show the same tools doing
the same job, on something that runs on every change rather than once on a laptop, and it can't
cost money.

## Decision

On every pull request and push to main, the `cluster` job in `.github/workflows/ci.yml` builds the
shop into a container, makes a throwaway cluster, and lets Argo CD deploy it.

1. **The image.** `Dockerfile` builds Next's standalone server (`output: "standalone"`, switched on
   only by `NEXT_OUTPUT`, so Vercel's build is untouched) and runs it as the unprivileged node user.
   The same build stage, tagged `tools`, runs the seed Job. Both start from Node 24 on Alpine,
   pinned by digest, and `.dockerignore` keeps every `.env*` file out.
2. **The cluster.** kind (Kubernetes in Docker) v0.33.0, its binary checked against its published
   SHA-256, with Kubernetes 1.37 pinned by digest. AKS is Kubernetes too, so the chart and Argo CD
   behave the same. Azure would mean an account and a bill.
3. **Argo CD.** v3.5.7, installed from its release manifest, checked against a SHA-256 taken when
   this was written. `deploy/argocd/application.yaml` points it at `deploy/chart` in this
   repository. CI sets the revision to the commit under test, so Argo CD reads the chart from
   GitHub as it would in production, rather than from the runner's checkout.
4. **The chart.** `deploy/chart` deploys four things, in order, by Argo CD sync waves:
   - Postgres;
   - Neon's proxy in front of it, as in the load test (ADR 0006);
   - a Job that migrates and seeds a week of the shop (`scripts/cluster/seed.ts`);
   - the shop, in two pods.

   The order matters: health says "degraded" until today and tomorrow are written, so the shop
   mustn't start before the seed is done. The shop's pods are ready only once health answers. A
   rollout adds one pod before it removes one. Every container of the shop's own runs as a user
   who isn't root, with no capabilities and a read-only root file system.
5. **The database endpoint.** The app keeps its one production driver. In the cluster,
   `LOCAL_NEON_ENDPOINT` points it at the proxy's Service, because there 127.0.0.1 is the pod itself.
   The app honours it only for the local host name `db.localtest.me`, so the setting can never
   send a real Neon URL, password and all, anywhere else.
6. **The check.** CI times the Application from applied to Synced and Healthy. It then asks
   `/api/v1/health` through the shop's NodePort, which kind maps to the runner, and fails unless:
   - health is ok;
   - it names the commit CI built (`GIT_COMMIT_SHA`, baked into the image);
   - every pod is ready.

   On main the figure is posted to `/office` as the `cluster` kind, by a job of its own that holds
   the secret and runs no image, as the load test's does.

## Consequences

- **No Ingress.** ingress-nginx, the controller every kind guide uses, was retired in March 2026.
  GM's reason for one was a single origin without CORS, and the shop already has that: its pages
  and its API come from one Next.js server. So CI reaches the shop through a NodePort, and the
  claim says why rather than installing a controller to show off.
- **One service, not fifteen.** The card says so. The chart's other two Deployments are the
  database and its proxy, and they aren't counted as services.
- **Not a release gate.** The cluster isn't production, and a slow image pull on a runner
  shouldn't hold a deploy. It's a check on every pull request all the same, so a broken chart or
  image is seen before it merges.
- **CI downloads three things:**
  - kind's binary, about 10 MB, checksum-checked;
  - Argo CD's manifest, checksum-checked;
  - images pinned by digest: kind's node, Postgres and the proxy.

  Argo CD's own images are named by tag in its release manifest. The checksum fixes which tags,
  but a tag can still be pushed again upstream, so those three images are the one thing not
  pinned by content.
- **The proxy is the community image of ADR 0006**, built in debug mode, with pooling switched on
  for every client as Neon's own proxy does. It sits only between the shop and a throwaway
  Postgres.
