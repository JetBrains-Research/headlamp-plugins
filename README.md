# JetBrains Research Headlamp Plugins

[![JetBrains Research](https://jb.gg/badges/research.svg)](https://github.com/JetBrains#jetbrains-on-github)

[Headlamp](https://headlamp.dev) plugins built and used by JetBrains Research.

## Plugins

| Plugin                                 | Description                                                                         |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| [applications](./applications)         | Applications view that groups Kubernetes resources by the recommended labels.      |
| [cloud-shell](./cloud-shell)           | Opens an interactive shell session in the cluster.                                  |
| [gke-nvidia-gpu](./gke-nvidia-gpu)     | NVIDIA GPU overview and topology for GKE nodes.                                     |
| [network-policies](./network-policies) | Visualizes `NetworkPolicy` resources.                                               |
| [themes](./themes)                     | JetBrains themes for Headlamp.                                                      |

## Installing

Each release ships a `headlamp-plugin package` archive on [GitHub Releases][releases]
and a container image at `ghcr.io/jetbrains-research/headlamp-plugin-<plugin>`.
To load a plugin into an in-cluster Headlamp through an init container,
see [Using an image](docs/releases.md#using-an-image).

## Layout

Each top-level directory is a standalone plugin with its own `package.json`, `package-lock.json`, version and release.
There is no shared root package.

## Development

Requires Node.js 22 and [`just`](https://github.com/casey/just) (optional).

```sh
just install themes # npm ci
just start themes   # watch mode against a running Headlamp application
just check themes   # build, type check, lint, format check
just image themes   # build the container image locally
```

Omit the plugin name for `install` and `check` to run against every plugin.
Pull requests run the checks only for plugins they change.
Changes to `.github/`, `scripts/`, or the `Dockerfile` run them for all plugins.

## Adding a plugin

```sh
npx --yes @kinvolk/headlamp-plugin create $NAME
```

Then set `"name": "@jetbrains/$NAME"`, keep the version at `0.1.0`,
and make sure `package.json` has the `package` script (`headlamp-plugin package`).
Add a row to the table above, and add the directory to the `npm` entry in `.github/dependabot.yaml`.

## Releases

See [Releasing a plugin](docs/releases.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report vulnerabilities as described in [SECURITY.md](SECURITY.md).

## License

See [LICENSE](LICENSE).

[releases]: https://github.com/JetBrains-Research/headlamp-plugins/releases
