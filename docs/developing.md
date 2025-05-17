# Developing

?> Want to contribute? Development help [**welcome**](https://github.com/dermotduffy/advanced-camera-card/issues/1248)!

## Building

This project uses [Volta](https://github.com/volta-cli/volta) to ensure a
consistent version of Node and Yarn are used during development. If you install
Volta in your environment, you should not need to worry about which version of
both to choose. **Note:** the dev container already comes with Volta installed.

However, if you are not using Volta, you can check the `volta` key in the
`package.json` to see which version of Node and Yarn should be used.

```sh
$ git clone https://github.com/dermotduffy/advanced-camera-card
$ cd advanced-camera-card
$ yarn install
$ yarn run build
```

Resultant build entry file will be in `dist/advanced-camera-card.js`. This could be
installed via the [manual installation
instructions](advanced-installation.md?id=manual-installation).

## Releasing

### Release Philosophy

Post `v6.0.0`, all releases are automated with ([semantic-release](https://github.com/semantic-release/semantic-release)) after every merged commit. This significantly reduces the time between merge and ability for users to try the change, but also entirely removes the "emotional notion" that a new major release version (i.e. `v6` -> `v7`) contains major new features. Rather it may simply contain a single backwards incompatible change.

Releases follow [Semantic Versioning](https://semver.org/) with the following definitions:

- **MAJOR** version changes for any backwards incompatible changes. This means any change that would _require_ users to update their card config, regardless of whether that update is automated or manual.
- **MINOR** version changes for any functionality added in a backwards compatible manner. This may mean new features or behavioral changes that do not require a card update.
- **PATCH** version changes for backward compatible bug fixes

### Manual Releases

1. Merge a PR that contains only a `package.json` version number bump.
1. Go to the [releases page](https://github.com/dermotduffy/advanced-camera-card/releases).
1. A release draft will automatically have been created, click 'Edit'.
1. Use the same version number for the release title and tag.
1. Choose 'This is a pre-release' for a beta version.
1. Hit 'Publish release'.

## Translations

To add translations, you can manually edit the JSON translation files in
`src/localize/languages` or use the [inlang](https://inlang.com/) online editor.

## Using a dev container

[![Open in Dev Containers](https://img.shields.io/static/v1?label=Dev%20Containers&message=Open&color=blue&logo=visualstudiocode)](https://vscode.dev/redirect?url=vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=https://github.com/dermotduffy/advanced-camera-card)

You can use the [VS Code Dev Containers](https://code.visualstudio.com/docs/remote/containers) extension to
speed up the development environment creation. Simply:

1. Clone the repository to your machine
2. Open VS Code on it
3. Reopen the folder in the Dev Container
4. Once done, press `F5` to start debugging

Everything should just work without any additional configuration. Under the
hood, the dev container setup takes care of bringing up:

- Home Assistant (port `8123` or the next available one)
- Frigate (ports `5000` or the next available one)
- MQTT (port `1883` or the next available one)

As docker-compose containers.

- The Frigate Home Assistant Integration is registered as a `git submodule` at `.devcontainer/frigate-hass-integration`, and VS Code will initialize/clone it for you before opening the dev container.

Some environment variables are supported in a `.env` file:

- `FRIGATE_VERSION`: The version of Frigate to use. Defaults to the latest stable version.
- `HA_VERSION`: The version of Home Assistant to use. Defaults to the latest stable version.

?> When not specifying any version, it's recommended that you `docker-compose pull` the stack from time to time to ensure you have the latest versions of the images.

The Home Assistant container will get preconfigured during first initialization,
therefore, if you changed the Home Assistant configuration, you will need to
remove the HA container and start another.
