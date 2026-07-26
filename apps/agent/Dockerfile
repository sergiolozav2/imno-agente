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

# Property reels are encoded in-process. Debian's ffmpeg is preferred over a
# static build because it links libass, which is what burns the Spanish subtitle
# track in. The font package is not optional: on a slim image with no fonts
# installed, libass and drawtext render nothing at all rather than failing.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*

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

# Reel scratch space. Deliberately not on the /data disk: these files are
# downloaded stills and one encode output, all deleted when the job ends.
ENV VIDEO_TEMP_DIR=/tmp/imno-video
RUN mkdir -p /tmp/imno-video && chown node:node /tmp/imno-video
ENV VIDEO_FFMPEG_PATH=/usr/bin/ffmpeg

USER node
WORKDIR /repo/apps/agent
EXPOSE 3002
CMD ["../../node_modules/.bin/tsx", "src/main.ts"]
