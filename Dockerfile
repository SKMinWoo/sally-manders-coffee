# The shop as a container image, for exhibit 11's cluster (deploy/chart, ADR 0008). Vercel never
# builds this: production is still Vercel's own build.
#
#   docker build --target runner --build-arg GIT_COMMIT_SHA=$(git rev-parse HEAD) -t sally-manders .
#   docker build --target tools  -t sally-manders-tools .
#
# Two images from one build. `runner` is Next's standalone server and nothing else, run as the
# unprivileged node user. `tools` is the build stage itself, dev dependencies and source included,
# for the one-off seed Job (scripts/cluster/seed.ts); it never serves a request.

# node 24 on Alpine, pinned by the digest of its multi-arch index
ARG NODE_IMAGE=node:24.22.3-alpine3.24@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# no install scripts, as in CI: nothing in the tree gets to run code while it installs
RUN npm ci --ignore-scripts

FROM ${NODE_IMAGE} AS tools
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
# health names this commit (server/api/v1.ts, buildCommit), so CI can tell the pods run what it built
ARG GIT_COMMIT_SHA=""
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 GIT_COMMIT_SHA=${GIT_COMMIT_SHA}
COPY --from=tools /app/.next/standalone ./
COPY --from=tools /app/.next/static ./.next/static
COPY --from=tools /app/public ./public
# the files stay root's and read-only; the chart mounts a scratch volume where Next writes its cache
USER node
EXPOSE 3000
CMD ["node", "server.js"]
