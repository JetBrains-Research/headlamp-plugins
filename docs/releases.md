# Releasing a plugin

Each plugin is versioned and released on its own. A release produces:

- a git tag `<plugin>-<version>`, e.g. `themes-0.2.0`;
- a GitHub release with the `headlamp-plugin package` archive
  `jetbrains-<plugin>-<version>.tar.gz` and its SHA256 in the notes;
- a container image `ghcr.io/jetbrains-research/headlamp-plugin-<plugin>`
  tagged `v<version>` and `latest`.

## Steps

1. In a pull request, bump the version in the plugin directory:

   ```sh
   cd themes
   npm version minor --no-git-tag-version   # updates package.json and package-lock.json
   ```

   CI rejects a `package.json` and `package-lock.json` that disagree.
2. Merge the pull request into `main`.
3. In **Actions**, run **Release plugin** on `main` and enter the plugin
   directory, e.g. `themes`.

The workflow refuses to run from other branches and refuses versions that
already have a tag. Release notes list the commits that touched the plugin
directory since its previous tag. Versions with a prerelease suffix
(`0.2.0-alpha`) are marked as prereleases.

## Failures

- **Image job failed:** use **Re-run failed jobs**. The GitHub release
  already exists and is left as is.
- **Release job failed before `Create release`:** fix the cause and run
  the workflow again. Nothing was published.
- **`Create release` failed partway:** delete the incomplete release and its
  tag, then run the workflow again.

A published version is never rebuilt. To ship a fix, bump the version.

## Using an image

The image copies the plugin into `/headlamp/plugins` when it starts, so it
works as a Headlamp init container that shares a `plugins` volume:

```yaml
initContainers:
  - name: plugin-themes
    image: ghcr.io/jetbrains-research/headlamp-plugin-themes:v0.1.0
    securityContext:
      runAsUser: 100
      runAsGroup: 101
      runAsNonRoot: true
    volumeMounts:
      - name: plugins
        mountPath: /headlamp/plugins
```

The plugin files live at `/plugins/<plugin>/` inside the image, if you need
a different copy command.

## Cloud shell image

The default `cloud-shell` session image, `ghcr.io/jetbrains-research/cloud-shell:latest`,
is defined inline in the **Publish Cloud Shell image** workflow.
It is rebuilt weekly, when the workflow changes on `main`, and on manual dispatch.
Any replacement image must keep running with its default command.
