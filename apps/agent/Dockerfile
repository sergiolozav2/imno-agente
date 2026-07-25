# Mastra agent runtime.
#
# Like the API image, the build context is the repo ROOT because the worker
# imports the `@imno/*` packages as source. Build locally with:
#   docker build -f apps/agent/Dockerfile -t imno-agent .
#
# There is no compile step: the process runs its TypeScript entrypoint through
# tsx, exactly as it does in development.

FROM node:22-bookworm-slim
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

COPY . .
RUN pnpm install --frozen-lockfile --filter "@imno/agent..."

ENV NODE_ENV=production
ENV PORT=3002
# Agent threads and messages live in libSQL. Mount a disk at /data to keep them
# across deploys; without one the memory is per-container.
ENV MASTRA_STORAGE_URL=file:/data/agent-memory.db
RUN mkdir -p /data && chown node:node /data

USER node
WORKDIR /repo/apps/agent
EXPOSE 3002
CMD ["../../node_modules/.bin/tsx", "src/main.ts"]
