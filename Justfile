#!/usr/bin/env -S just --justfile

set default-list
set minimum-version := '1.55.0'
set shell := ["/bin/bash", "-euo", "pipefail", "-c"]

[private]
plugins:
    @for pkg in */package.json; do if grep -q '@kinvolk/headlamp-plugin' "$pkg"; then dirname "$pkg"; fi; done

install plugin='':
    for dir in {{ if plugin == '' { '$(just plugins)' } else { plugin } }}; do (cd "$dir" && npm ci --no-audit --no-fund); done

check plugin='':
    for dir in {{ if plugin == '' { '$(just plugins)' } else { plugin } }}; do \
      echo "==> $dir"; \
      node scripts/release-info.mjs "$dir" >/dev/null; \
      (cd "$dir" && npm run build && npm run tsc && npm run lint && npm run format -- --check && npm run test --if-present); \
    done

start plugin:
    cd {{ plugin }} && npm start

image plugin tag='dev':
    docker build --build-arg PLUGIN={{ plugin }} --tag headlamp-plugin-{{ plugin }}:{{ tag }} .

clean:
    find . \( -name dist -o -name node_modules \) -type d -prune -exec rm -r {} +
