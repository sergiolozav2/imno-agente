# Public web app, deployed to Render.
#
# The build context is the repo ROOT because the app consumes the `@imno/*`
# packages as TypeScript source. Build locally with:
#   docker build -f apps/frontend/Dockerfile -t imno-frontend .

FROM node:22-bookworm-slim
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

COPY . .
RUN pnpm install --frozen-lockfile --filter "@imno/frontend..."

# `next.config.mjs` bakes the /api/admin -> Payload rewrite at build time, so the
# API origin has to be known here. Render injects service env vars as build args
# with the same name; locally pass --build-arg API_URL=...
ARG API_URL=http://localhost:3001
ENV API_URL=$API_URL

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo/apps/frontend
RUN pnpm exec next build

USER node
ENV PORT=3000
EXPOSE 3000
CMD ["pnpm", "exec", "next", "start", "-p", "3000"]
