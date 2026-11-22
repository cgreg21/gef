# npm releases

GEF publishes the `gnome-extension-framework` package from GitHub Releases.
The release workflow uses npm trusted publishing (OIDC); it does not use or
store an npm access token.

## Alpha channel

Prerelease versions (for example, `0.1.0-alpha.1`) are published with the npm
`next` dist-tag. They do not move the `latest` tag used by stable installs.

Install the latest alpha in an extension project:

```sh
npm install --save-dev gnome-extension-framework@next
npx --yes --package gnome-extension-framework@next gef --help
npx --yes --package gnome-extension-framework@next gef new my-extension
```

The publish workflow selects `next` for versions containing a prerelease
suffix and `latest` for stable versions.

## One-time setup

1. Check whether `gnome-extension-framework` is available:
   `npm view gnome-extension-framework name`. A successful result means the
   name is already registered; a 404 means it appears unclaimed at the time of
   the check, not that availability is reserved.
2. If the package does not exist yet, make the **first publication manually**
   from the repository using the npm account that will own it. Confirm the
   package name and version in `package.json`, then run:
   `npm install`, `npm run check`, `npm run build`,
   `npm run package:example`, and
   `npm publish --access public --tag next` for the first alpha.
   Complete any npm login or 2FA prompt locally. This one-time bootstrap is
   necessary because npm trusted publisher settings are configured on an
   existing package. Do not put an npm token in the repository or GitHub
   secrets for this workflow.
3. In the package settings on npmjs.com, add a GitHub Actions trusted publisher:
   - Owner: `cgreg21`
   - Repository: `gef`
   - Workflow filename: `publish.yml`
   - Environment: leave empty (the workflow does not use a GitHub environment)
   - Allow direct `npm publish`
4. Confirm that the package's repository is
   `https://github.com/cgreg21/gef.git`, matching `package.json`.

npm trusted publishing requires npm CLI 11.5.1+ and Node.js 22.14.0+.
The release workflow uses Node.js 24, upgrades npm to `^11.5.1` before
publishing, runs on GitHub-hosted runners and grants `id-token: write`. npm
generates provenance automatically for a public package published from this
public GitHub repository through OIDC.

## Release procedure

1. Update the `package.json` version and add the corresponding entry to
   `CHANGELOG.md`.
2. Run `npm run check`, `npm run build` and `npm run package:example`.
3. Push the version change to `main` and wait for every CI job to pass. For
   alpha candidates, also run `npm run test:gnome` on a GNOME Shell 51 host
   before creating the release.
4. Create a GitHub Release with the matching tag (for example,
   `v0.1.0-alpha.1` for package version `0.1.0-alpha.1`). The workflow rejects
   a release whose tag does not exactly match the `v`-prefixed package version.
5. Verify the release with `npm view gnome-extension-framework dist-tags` and
   install it in a clean project using
   `npx --yes --package gnome-extension-framework@next gef --help`.

Do not publish a second time with the same version. If a release fails, fix
the cause and publish a new patch or prerelease identifier. Do not delete or
overwrite a published version; use a new version and the appropriate npm
dist-tag.
