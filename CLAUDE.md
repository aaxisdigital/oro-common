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
- **"Aaxis" System Configuration tab** (`Resources/config/oro/system_configuration.yml`): the
  `aaxis` group only (top-level tab, priority 99 — below Oro's "System Configuration" tab at 255,
  above Commerce/CRM/Marketing at 0). Feature bundles attach their OWN second-level menu group
  directly under `aaxis` (`aaxis_tools` "Tools" 100, `aaxis_devtools` "DevTools" 95,
  `aaxis_ontology` "Ontology" 90 — no "Aaxis" prefix in the titles, the tab already says it) with
  their pages as third-level children; each page wraps its fields in a `<page>_section` fieldset
  because Oro hard-requires fields at nesting level 5 (tab > menu group > page > fieldset >
  fields). The old shared `aaxis_general` middle level is GONE. Config deep links use
  `activeGroup: 'aaxis'`, `activeSubGroup: '<page group>'` (the level-3 page, e.g.
  `aaxis_tools_queue_monitor`).
- **TypeScript build pipeline** (`Build/TypeScriptCompiler`, `Command/CompileTypeScriptCommand`,
  `EventListener/CompileTypeScriptOnAssetsBuildListener`). NOT auto-wired here — each consuming bundle
  instantiates them in its own `services.yml`, pointing at its own `tsconfig.json` and command name.
- **`tsconfig.base.json`** — the template each bundle's `tsconfig.json` extends (bundles ship their
  own copy, since each is a standalone Composer package with no fixed relative path to this one).
- **Grid widgets** (`Resources/js-src/app/widgets/{data-grid,dialog,record-form-modal}.ts`) + their
  `DataGrid` option `onRowClick(row, event)`: makes whole rows clickable (pointer cursor + hover,
  `aaxis-grid__row--clickable`; clicks on buttons/links/inputs/the actions cell keep their own
  behavior) — NOTE it DISABLES the cells' click-to-copy, the two gestures share one click. Used by
  the ontology Flows page to open the editor (no separate edit action there anymore).
  per-user layout store: `Entity/GridPreference`, `Manager/GridPreferenceManager`,
  `Controller/GridPreferenceController` (`aaxis_common_grid_preference_*`), table
  `aaxis_grid_preference`. Imported by consumers as `aaxiscommon/js/app/widgets/*`.
  - `onAction(actionKey, row, event?)` — the grid forwards the raw MouseEvent so NAVIGATING
    actions can honor **cmd/ctrl+click = open in a new tab** via the named export
    `navigateTo(url, event?)` (row actions are `<button>`s, so the browser can't offer its native
    gesture). Any handler that ends in `window.location.assign/href` should call `navigateTo`
    with the forwarded event instead.
  - `RecordFormModal` shows a **busy spinner inside the submit button** while `onSubmit` is in
    flight (`.aaxis-rfm__submit-spinner`, same treatment as the flow editor's save/debug buttons),
    so every consumer — Systems, Entities, … — gets the feedback without opting in.
  - `RecordFormModal` top-level fields stack one-per-line by default. To put several on one line,
    give them the same `row: '<id>'` and a `width: '<n>%'` (the number is the flex ratio, e.g.
    45/45/10). `collection` fields can't share a row. CSS: `.aaxis-rfm__row` in `grid.scss`.
  - `RecordFormModal` field types: text / `password` (show-hide eye toggle; value is NOT trimmed —
    the input carries `data-type="password"` so reads survive the toggle flipping its `type`; the
    toggle needs its `z-index: 2` — Oro's global `input:focus` rule sets `z-index: 1`, which DOES
    apply because the input is a flex item of `.aaxis-rfm__password`, and without the override the
    focused input paints over the icon exactly while the value is being edited) /
    textarea / number (`min`/`max` validated on submit + set as input attrs) / boolean / select /
    collection. Any non-collection field takes an optional `hint` (muted helper line under the
    control, `.aaxis-rfm__hint`) and `disabled: true` (grayed control — still collected on submit
    but skips required/min-max validation; prefer disabling over hiding conditional fields).
    Modal option `resizable: false` removes the dialog's resize handle. The show/hide labels are
    `aaxis.common.grid.show_value` / `hide_value` (jsmessages).
  - `GridAction` renders either an `icon` (Font-Awesome class) **or** a `badge` — a short text pill
    (`.aaxis-grid__action-badge`) for actions that read better as a word than a glyph, e.g. Ontology's
    `dwl`. Both fields are optional; set exactly one. ⚠️ `.aaxis-grid__badge` is a DIFFERENT, older
    class (the boolean column's on/off pill) — don't conflate them.
  - The filter popover and the column menu close on **Escape** as well as on an outside click
    (`onDocKeydown` → `onEscape`, torn down in `dispose()` alongside the click handler); Escape on
    the filter returns focus to its funnel button.
  - `DataGrid.setFilter(key, {operator, value} | null)` applies/clears a column filter
    programmatically — for deep links that arrive pre-filtered (Ontology's Entities → Data View
    action). It resets to page 1 and re-renders, exactly like the filter popover's Apply, and the
    filter stays visible and clearable in the UI.
  - ⚠️ **The actions column width is computed, not fixed.** The table is `table-layout: fixed` and
    every `td` ellipsizes, so a too-narrow actions cell doesn't wrap — it silently *hides* buttons
    (the symptom is a lone "DWL …" where three actions should be). `actionsColumnWidth()` sizes the
    header cell inline from the action set (~28px per icon, badge length + padding, floored at the
    historical 110px so icon-only grids are unchanged), and `td.aaxis-grid__col-actions` overrides
    the ellipsis with `overflow: visible` so any future underestimate spills visibly instead of
    disappearing. Adding an action with wide content? Check the estimate there.
  - `Dialog` options: `width`, `height`, `movable` (adds a drag handle on the header — the dialog is
    flex-centred until the first drag, then pinned to `position: fixed` left/top so pointer moves can
    place it directly; drags starting on ✕ are ignored), `bodyClass` (styling hook on the body, e.g.
    Ontology's `.aaxis-dwl` turns it into a flex column so the CSS resize handle grows the content
    instead of scrolling it), and `onClose`. ✕ / Escape / backdrop all close and clean up.
  - `RecordFormModal` extras: consecutive fields sharing a `tabGroup` render as a tab strip (one
    tab per field, labelled by `tabLabel`; inactive panels stay in the DOM so values still
    collect; a collection in a tab drops its own title). Modal option `testAction: {label, onTest}`
    adds a button on the LEFT of Cancel/Submit — `onTest(values)` gets the current values
    (unvalidated) and resolves a `TestOutcome` `{success, message?, steps?}` rendered as a
    checklist above the actions row (strings: `aaxis.common.grid.testing/test_success/test_error`).
  - Oro's admin theme gives inputs/selects/textareas a **fixed width**, so `grid.scss` re-asserts
    `width: 100%` with element-qualified selectors (`input.aaxis-rfm__control`, …). Any new control
    markup must keep the `aaxis-rfm__control` class or it will render ~230px wide and break
    multi-field rows. The theme also adds `margin-bottom: 8px` to every control; `grid.scss` zeroes
    it (fields own their spacing, and the stray margin made the password wrapper 8px taller than
    its input, which pushed the absolutely-centered show/hide toggle off-centre).
  - Selects are upgraded to **Select2**, which copies the original `<select>`'s classes onto the
    generated `.select2-container` — so `.form-control`'s padding/height land on the container, and
    Oro pins `.select2-container` at `height: 32px`. The combo's height therefore belongs on the
    CONTAINER (a taller `.select2-choice` just overflows the visible border), and `.select2-chosen`
    needs `height: auto` or its fixed 30px pins the label to the top of the combo. `grid.scss` does
    this for both `.aaxis-rfm` and `.aaxis-dialog`; keep the two blocks in step.
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
- In TS classes extending Oro's `BaseComponent` (any bundle), never use class-field initializers:
  the base constructor calls `initialize()` before they run, and they then overwrite whatever
  `initialize()` assigned. Declare fields with `!:` and assign them in `initialize()`. Plain
  classes (the DataGrid/Dialog widgets here) are unaffected.
- Only the `.ts` sources in `Resources/js-src` are committed. The emitted `.js`/`.d.ts` under
  `Resources/public/js` are **generated** at asset-build time and **git-ignored** — never commit or
  hand-edit them. `TypeScriptCompiler` now also rebuilds when this bundle is installed under
  `vendor/aaxisdigital/oro*`, and the asset build **fails loudly** (no silent skip) if `tsc` is
  missing or compilation fails — so the consuming app must have `typescript` installed
  (`node_modules/.bin/tsc`).

## Verify after changes

```bash
php bin/console cache:clear --no-interaction
php bin/console debug:router | grep aaxis_common
php bin/console debug:container --tag=aaxis_common.connection_tester   # all bundles' testers visible
```
`lint:container` currently fails on an unrelated pre-existing Oro alias issue
(`UserAuthorizationCheckerInterface`); use `cache:clear` as the compile check.
