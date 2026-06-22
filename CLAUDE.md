# CLAUDE.md — AaxisCommonBundle

Guidance for working in this bundle. Read alongside `README.md` (user-facing).

## What this bundle is

The shared base for every Aaxis bundle. Cross-cutting infrastructure lives here exactly once;
`AaxisToolsBundle`, `AaxisDevToolsBundle`, `AaxisOntologyBundle`, … all depend on it and remain
independent of each other. **When something is needed by two or more Aaxis bundles, it belongs here**
— don't duplicate it.

## Identity / naming conventions

| Thing | Value |
|-------|-------|
| PHP namespace | `Aaxis\Bundle\CommonBundle` |
| Bundle class | `AaxisCommonBundle` (auto-registered via `Resources/config/oro/bundles.yml`) |
| Config alias | `aaxis_common` |
| Route prefix / names | `/aaxis/common` · `aaxis_common_*` |
| Twig namespace | `@AaxisCommon/...` |
| Asset namespace | `aaxiscommon` (`bundles/aaxiscommon/...`, JS ids `aaxiscommon/js/...`) |
| Translation root | `aaxis.common.*` |
| ACL capability | `aaxis_common` |

## What lives here (and how consumers use it)

- **`aaxis_tab` menu group** (`navigation.yml`) + its `aaxis-menu-icon` glyph
  (`Resources/public/css/scss/menu-icon.scss`). Each feature bundle attaches its own sub-group under
  `aaxis_tab` (e.g. `aaxis_tools_group`, `aaxis_devtools_group`).
- **TypeScript build pipeline** (`Build/TypeScriptCompiler`, `Command/CompileTypeScriptCommand`,
  `EventListener/CompileTypeScriptOnAssetsBuildListener`). NOT auto-wired here — each consuming bundle
  instantiates them in its own `services.yml`, pointing at its own `tsconfig.json` and command name.
- **`tsconfig.base.json`** — the template each bundle's `tsconfig.json` extends (bundles ship their
  own copy, since each is a standalone Composer package with no fixed relative path to this one).
- **Grid widgets** (`Resources/js-src/app/widgets/{data-grid,dialog,record-form-modal}.ts`) + their
  per-user layout store: `Entity/GridPreference`, `Manager/GridPreferenceManager`,
  `Controller/GridPreferenceController` (`aaxis_common_grid_preference_*`), table
  `aaxis_grid_preference`. Imported by consumers as `aaxiscommon/js/app/widgets/*`.
  - `RecordFormModal` top-level fields stack one-per-line by default. To put several on one line,
    give them the same `row: '<id>'` and a `width: '<n>%'` (the number is the flex ratio, e.g.
    45/45/10). `collection` fields can't share a row. CSS: `.aaxis-rfm__row` in `grid.scss`.
- **Connection-test registry** — `Connection/ConnectionTesterInterface`,
  `Connection/ConnectionTestRegistry` (tagged-locator, `index_by: tool`),
  `Controller/ConnectionTestController` (`aaxis_common_connection_test`), and
  `Resources/js-src/app/components/connection-test-component.ts`. Feature bundles supply per-tool
  testers tagged `aaxis_common.connection_tester` (`tool: <key>`). See any feature bundle's
  `CLAUDE.md` for the contributor side.
- **`Command/HistoryRetentionPurger`** — shared `purge(entityClass, days)` for the bundles' nightly
  history-cleanup cron commands.
- **`Resources/views/Tools/help.html.twig`** — shared tool-help Twig macro; partials import it as
  `@AaxisCommon/Tools/help.html.twig`.

## Gotchas / rules

- **Dependency direction is one-way**: CommonBundle must NOT reference any feature bundle's classes.
  Cross-bundle collaboration goes through interfaces + DI tags (the connection-test registry is the
  reference example). If you find yourself wanting to `use Aaxis\Bundle\(Dev)ToolsBundle\...` here,
  invert it with a tag/interface instead.
- The `aaxis_common` ACL gates `GridPreferenceController` and `ConnectionTestController`; it's granted
  to the admin role by `Migrations/Data/ORM/LoadAaxisCommonAdminPermissions`.
- Schema is a single consolidated installer (`Migrations/Schema/AaxisCommonBundleInstaller`) — this is
  pre-production, so edit the install rather than adding upgrade migrations.
- Both `.ts` sources and the emitted `.js`/`.d.ts` in `Resources/public/js` are committed.

## Verify after changes

```bash
php bin/console cache:clear --no-interaction
php bin/console debug:router | grep aaxis_common
php bin/console debug:container --tag=aaxis_common.connection_tester   # all bundles' testers visible
```
`lint:container` currently fails on an unrelated pre-existing Oro alias issue
(`UserAuthorizationCheckerInterface`); use `cache:clear` as the compile check.
