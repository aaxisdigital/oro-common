# Aaxis Common Bundle

Shared base bundle for the Aaxis Oro bundles. It holds cross-cutting infrastructure that would
otherwise be duplicated across each Aaxis bundle, so it lives in exactly one place.

- Namespace: `Aaxis\Bundle\CommonBundle`
- Bundle class: `AaxisCommonBundle` (auto-registered)

The other Aaxis bundles (`AaxisToolsBundle`, `AaxisOntologyBundle`, ...) depend on this bundle.
They remain independent of **each other** — each can be installed with or without the others — but
they all require CommonBundle to be present.

---

## What it provides

### Shared "Aaxis" application-menu group
Defines the top-level **`aaxis_tab`** menu node (label "Aaxis") and its **`aaxis-menu-icon`** glyph
(`Resources/public/css/scss/menu-icon.scss`). Each Aaxis bundle attaches its own sub-group under
`aaxis_tab` in its own `navigation.yml`; the parent node and icon are defined here once.

### TypeScript build pipeline
Reusable classes used by every Aaxis bundle that ships TypeScript:

- `Build/TypeScriptCompiler` — runs the project's local `tsc` against a given `tsconfig.json`.
- `Command/CompileTypeScriptCommand` — `bin/console` wrapper around the compiler.
- `EventListener/CompileTypeScriptOnAssetsBuildListener` — recompiles before `oro:assets:build`.

These are **not** auto-registered here. Following the existing per-bundle pattern, each consuming
bundle wires its own instances in its `services.yml`, pointing the compiler at its own
`Resources/js-src/tsconfig.json` and giving the command its own name, e.g.:

```yaml
aaxis_tools.typescript_compiler:
    class: Aaxis\Bundle\CommonBundle\Build\TypeScriptCompiler
    arguments:
        - '%kernel.project_dir%'
        - '@logger'
        - '%kernel.project_dir%/src/Aaxis/Bundle/ToolsBundle/Resources/js-src/tsconfig.json'
        - 'AaxisToolsBundle'

aaxis_tools.typescript_compile_command:
    class: Aaxis\Bundle\CommonBundle\Command\CompileTypeScriptCommand
    arguments: ['@aaxis_tools.typescript_compiler', 'aaxis:tools:typescript:compile']
    tags:
        - { name: console.command, command: 'aaxis:tools:typescript:compile' }

aaxis_tools.compile_typescript_on_assets_build_listener:
    class: Aaxis\Bundle\CommonBundle\EventListener\CompileTypeScriptOnAssetsBuildListener
    arguments: ['@aaxis_tools.typescript_compiler']
    tags:
        - { name: kernel.event_subscriber }
```

### Reusable DataGrid + grid preferences
A self-contained front-end **DataGrid** widget (client-side sorting/filtering/paging, per-column
show/hide and reorder) plus companion **dialog** and **record-form-modal** widgets, in
`Resources/js-src/app/widgets`. Their styles live in `Resources/public/css/scss/grid.scss` and their
strings under the `aaxis.common.grid.*` translations. Consuming bundles import them as
`aaxiscommon/js/app/widgets/*` (TypeScript resolves the emitted declarations via a `paths` mapping).

The widget's per-user layout (column order/visibility, page size) is persisted by the
**`GridPreference`** store (table `aaxis_grid_preference`, `Manager/GridPreferenceManager`,
`Controller/GridPreferenceController` exposing `aaxis_common_grid_preference_get|save`). Access is
gated by the `aaxis_common` action ACL, granted to the Administrator role by
`Migrations/Data/ORM/LoadAaxisCommonAdminPermissions`; the `aaxis_grid_preference` table is created
by `Migrations/Schema/AaxisCommonBundleInstaller`.

### Base TypeScript config
`Resources/js-src/tsconfig.base.json` holds the shared `compilerOptions` used as the template for
every Aaxis bundle. Because each bundle is published as its own Composer package (no fixed relative
path to this one), each ships a copy of this base and its `tsconfig.json` extends the local copy,
setting only its `rootDir` / `outDir` / `include`:

```json
{
    "extends": "./tsconfig.base.json",
    "compilerOptions": { "rootDir": ".", "outDir": "../public/js" },
    "include": ["**/*.ts"],
    "exclude": ["../public/js"]
}
```

### Connection-test registry ("Test it" buttons)
The shared infrastructure behind the **"Test it"** button shown next to a tool's *Enabled* setting in
System Configuration:

- `Connection/ConnectionTesterInterface` — contract a tool implements: `getTool()` +
  `test(array $overrides): array` (returning `{success, message, details}`; passwords must be masked).
- `Connection/ConnectionTestRegistry` — receives a `!tagged_locator` of all testers
  (`index_by: tool`) and dispatches by tool key.
- `Controller/ConnectionTestController` — the single endpoint `aaxis_common_connection_test`
  (`/aaxis/common/connection-test/{tool}`), gated by the `aaxis_common` ACL.
- `Resources/js-src/app/components/connection-test-component.ts` — the front-end control. Config
  fields wire it via `data-page-component-module: 'aaxiscommon/js/app/components/connection-test-component'`
  and `data-page-component-options: '{"tool":"<tool_key>"}'`.

Feature bundles contribute their own testers, tagged so the registry finds them:

```yaml
Aaxis\Bundle\DevToolsBundle\Connection\RedisConnectionTester:
    arguments: ['@Aaxis\Bundle\DevToolsBundle\Redis\RedisInspector']
    tags:
        - { name: aaxis_common.connection_tester, tool: redis_viewer }
```

### History-retention purge
`Command/HistoryRetentionPurger` — shared `purge(entityClass, days): int` (deletes records whose
`runAt` is older than `days`; `0` keeps everything). Each bundle's nightly cleanup command reads its
own retention config keys and calls this, so the delete logic lives in one place.

### Shared tool-help macro
`Resources/views/Tools/help.html.twig` — a presentational Twig macro that renders a tool's help
dialog from a translations-driven `sections` structure. Tool help partials import it as
`@AaxisCommon/Tools/help.html.twig`.

---

## Installation

Add the repository and require the package (the project already has the Oro Composer registry
configured, so `oro/platform` resolves):

```jsonc
// composer.json
"repositories": {
    "aaxis-common": { "type": "vcs", "url": "git@github.com:aaxisdigital/oro-common.git" }
}
```

```bash
composer require aaxisdigital/oro-common:7.0.*
```

The bundle is auto-registered via `Resources/config/oro/bundles.yml` (the Oro kernel scans `vendor/`
and `src/` — no `AppKernel` edit needed). After install/update:

```bash
php bin/console cache:clear --no-interaction
php bin/console oro:migration:load --force                 # creates aaxis_grid_preference (+ admin ACL)
php bin/console oro:assets:build --no-interaction          # compiles SCSS/JS bundles
php bin/console oro:translation:load --no-interaction
php bin/console oro:translation:rebuild-cache --no-interaction
```

The shared TypeScript widgets are compiled by the consuming bundles' own `aaxis:*:typescript:compile`
commands (this bundle's widgets are emitted into `Resources/public/js` and committed).
