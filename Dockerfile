# Builds one plugin: docker build --build-arg PLUGIN=<directory> .
# Plugin output is plain JS, so the build stage runs natively on the build host for every target platform.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
ARG PLUGIN
RUN test -n "$PLUGIN" || { echo "PLUGIN build argument is required" >&2; exit 1; }
WORKDIR /src/${PLUGIN}
COPY ${PLUGIN}/package.json ${PLUGIN}/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY ${PLUGIN}/ ./
RUN npm run build && mkdir -p /plugins && npx --no-install headlamp-plugin extract . /plugins/${PLUGIN}

FROM busybox:1.38-musl
COPY --from=build --chown=100:101 /plugins /plugins
USER 100:101
# Init-container default: copy the plugin into Headlamp's shared plugins volume.
ENTRYPOINT ["sh", "-c", "cp -r /plugins/. /headlamp/plugins/"]
