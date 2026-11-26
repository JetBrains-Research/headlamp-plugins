# Contributing

Bug reports, fixes and improvements to the existing plugins are welcome.

## Before you start

- **Bugs:** open an issue with the plugin name and version, your Headlamp version,
  steps to reproduce, and any errors you see.
- **Features and new plugins:** open an issue first, so we can agree on the approach before you write code.
- **Security vulnerabilities:** report them privately, as described in [SECURITY.md](SECURITY.md).

## Development setup

See [Development](README.md#development) and [Adding a plugin](README.md#adding-a-plugin) in the README.

## Pull requests

- Fork the repository and branch off `main`.
- Keep each pull request to one logical change, ideally in one plugin.
  Split large or complicated changes into stacked pull requests, each small enough to review on its own,
  and link the pull request each one depends on in its description.
- Update the README when you add a plugin or change what one does.
- Bump a plugin version only as described in [Releasing a plugin](docs/releases.md).

## Acceptance criteria

We merge a pull request when:

- All CI checks pass.
- A code owner from [CODEOWNERS](.github/CODEOWNERS) has approved it.
- Review comments are resolved.

## License

By contributing, you agree to license your contributions under the project's [LICENSE](LICENSE).
