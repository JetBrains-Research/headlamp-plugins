# Updating dependencies

Dependabot opens update pull requests once a month, as configured in `.github/dependabot.yaml`.

## Grouping

- **npm:** minor and patch updates for every plugin arrive in one pull request.
  Each major update gets its own pull request, so a breaking change doesn't block the rest.
- **Docker and GitHub Actions:** one pull request per ecosystem, with every update in it.

## Major updates

CI doesn't load plugins into Headlamp.
Before merging a major update, try the affected plugin in a running Headlamp.

## Node

Dependabot skips major Node updates.
The `Dockerfile`, the workflows and the README must name the same Node version,
so bump it in all three by hand, in one pull request.
