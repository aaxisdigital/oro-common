import $ from 'jquery';
import __ from 'orotranslation/js/translator';

export type GridColumnType = 'text' | 'boolean' | 'number' | 'datetime' | 'json';

export interface GridColumn {
    /** Property name on the row object. */
    key: string;
    /** Header label (already translated). */
    label: string;
    /** Default rendering / filter control. Defaults to 'text'. */
    type?: GridColumnType;
    /** Whether the column header can sort. Defaults to true. */
    sortable?: boolean;
    /** Whether the column has a filter control. Defaults to true. */
    filterable?: boolean;
    /** Whether the column can be hidden via the column-settings menu. Defaults to true. */
    hideable?: boolean;
    /** Whether the column starts hidden. Defaults to false. */
    hidden?: boolean;
    /** Optional fixed width (CSS value). */
    width?: string;
    /** Custom cell renderer; returns a string or a DOM/jQuery node. */
    render?: (row: any) => any;
    /**
     * Value copied when the cell is clicked. Needed for columns whose render() returns a node
     * (e.g. a truncated value with a preview button); for plain/string cells the shown text is
     * copied automatically.
     */
    copyValue?: (row: any) => string;
}

export interface GridAction {
    key: string;
    label: string;
    icon: string;
    variant?: 'default' | 'danger';
    /**
     * Per-row predicate: when it returns true the action button is rendered disabled (greyed,
     * non-clickable) for that row. Use {@see disabledTitle} to explain why.
     */
    disabled?: (row: any) => boolean;
    /** Tooltip shown on the action button when {@see disabled} returns true for the row. */
    disabledTitle?: string;
}

export interface DataGridOptions {
    columns: GridColumn[];
    rows?: any[];
    idKey?: string;
    actions?: GridAction[];
    emptyText?: string;
    pageSize?: number;
    pageSizeOptions?: number[];
    /** Identifier used to persist per-user layout (order/visibility/page size). */
    gridKey?: string;
    /** URL for GET/PUT of the per-user preferences (already includes the grid key). */
    preferencesUrl?: string;
    onAction?: (actionKey: string, row: any) => void;
}

interface ColumnFilter {
    operator: string;
    value: any;
    dateMode?: 'date' | 'datetime';
    jsonPath?: string;
}

/**
 * Reusable, self-contained data grid with per-column header sorting and per-column filtering.
 *
 * Each filterable column header shows a funnel icon (greyed when no filter is set, dark when
 * active). Clicking it opens a popover with a type-aware operator and value control. Sorting and
 * filtering happen client-side.
 */
export default class DataGrid {
    private readonly columns: GridColumn[];
    private readonly actions: GridAction[];
    private readonly idKey: string;
    private readonly emptyText: string;
    private readonly onAction?: (actionKey: string, row: any) => void;

    private rows: any[] = [];
    private loaded = false;
    private sortKey: string | null = null;
    private sortDir: 'asc' | 'desc' = 'asc';
    private filters: Record<string, ColumnFilter> = {};
    private hiddenColumns: Record<string, boolean> = {};
    private columnOrder: string[] = [];
    private dragKey: string | null = null;
    private readonly gridKey?: string;
    private readonly preferencesUrl?: string;

    private readonly pageSizeOptions: number[];
    private pageSize: number;
    private currentPage = 1;

    private $root: any = null;
    private $thead: any = null;
    private $tbody: any = null;
    private $popover: any = null;
    private $pager: any = null;
    private $colMenu: any = null;
    private $overlay: any = null;
    private popoverCol: GridColumn | null = null;
    private readonly onDocClick: (e: any) => void;

    constructor(options: DataGridOptions) {
        this.columns = options.columns;
        this.actions = options.actions || [];
        this.idKey = options.idKey || 'id';
        this.emptyText = options.emptyText || __('aaxis.common.grid.empty');
        this.onAction = options.onAction;
        this.rows = options.rows || [];
        this.pageSizeOptions = options.pageSizeOptions || [10, 25, 50, 100];
        this.pageSize = options.pageSize || 25;
        this.gridKey = options.gridKey;
        this.preferencesUrl = options.preferencesUrl;
        this.columnOrder = this.columns.map(col => col.key);
        this.columns.forEach(col => {
            if (col.hidden) {
                this.hiddenColumns[col.key] = true;
            }
        });
        this.onDocClick = (e: any) => this.maybeCloseFilter(e);
    }

    /** Columns in the user-defined display order. */
    private orderedColumns(): GridColumn[] {
        const byKey: Record<string, GridColumn> = {};
        this.columns.forEach(col => {
            byKey[col.key] = col;
        });
        const ordered: GridColumn[] = [];
        this.columnOrder.forEach(key => {
            if (byKey[key]) {
                ordered.push(byKey[key]);
            }
        });
        // Append any columns missing from the saved order.
        this.columns.forEach(col => {
            if (this.columnOrder.indexOf(col.key) === -1) {
                ordered.push(col);
            }
        });
        return ordered;
    }

    /**
     * Columns actually rendered into the table, in display order. Hidden columns are omitted from
     * the DOM entirely rather than rendered and `display:none`-d: under `table-layout: fixed` a
     * hidden cell still claims an equal column share, which then collapses to zero width and leaves
     * dead space on the right. Skipping them lets the visible columns fill the full table width.
     */
    private visibleColumns(): GridColumn[] {
        return this.orderedColumns().filter(col => this.hiddenColumns[col.key] !== true);
    }

    /** Renders the grid into the given container (replaces its content). */
    mount($container: any): this {
        this.$root = $('<div/>', {'class': 'aaxis-grid'});

        const $table = $('<table/>', {'class': 'aaxis-grid__table grid table-hover table-bordered table'});
        this.$thead = $('<thead/>');
        this.$tbody = $('<tbody/>');
        $table.append(this.$thead, this.$tbody);
        this.renderHead();

        this.$popover = $('<div/>', {'class': 'aaxis-grid__popover', hidden: 'hidden'});
        this.$colMenu = $('<div/>', {'class': 'aaxis-grid__colmenu', hidden: 'hidden'});
        this.$overlay = $('<div/>', {'class': 'aaxis-grid__overlay'}).append(
            $('<span/>', {'class': 'aaxis-grid__overlay-spinner fa fa-spinner fa-spin', 'aria-hidden': 'true'}),
            $('<span/>', {'class': 'aaxis-grid__overlay-text', text: __('aaxis.common.grid.loading')})
        );
        this.$pager = this.buildPager();
        this.$root.append(this.$pager, $table, this.$popover, this.$colMenu, this.$overlay);
        $container.empty().append(this.$root);

        this.$root.on('click', 'th[data-sort-key]', (e: any) => this.onHeaderClick(e));
        this.$root.on('click', '[data-role="filter-btn"]', (e: any) => this.onFilterButton(e));
        this.$root.on('click', '[data-action]', (e: any) => this.onActionClick(e));
        this.$root.on('click', 'td.aaxis-grid__cell--copyable', (e: any) => this.onCellCopy(e));
        this.$colMenu.on('change', '[data-col-toggle]', (e: any) => this.onColumnToggle(e));
        this.$colMenu.on('dragstart', '[data-col-key]', (e: any) => this.onColDragStart(e));
        this.$colMenu.on('dragover', '[data-col-key]', (e: any) => this.onColDragOver(e));
        this.$colMenu.on('drop', '[data-col-key]', (e: any) => e.preventDefault());
        this.$colMenu.on('dragend', '[data-col-key]', () => this.onColDragEnd());
        this.$pager.on('change', '[data-role="page-size"]', (e: any) => this.onPageSizeChange(e));
        this.$pager.on('click', '[data-role="prev"]', () => this.goToPage(this.currentPage - 1));
        this.$pager.on('click', '[data-role="next"]', () => this.goToPage(this.currentPage + 1));
        this.$pager.on('keydown', '[data-role="page-number"]', (e: any) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.goToPageInput($(e.currentTarget).text());
                $(e.currentTarget).trigger('blur');
            }
        });
        this.$pager.on('focusout', '[data-role="page-number"]', (e: any) => this.goToPageInput($(e.currentTarget).text()));
        $(document).on('click.aaxisGrid', this.onDocClick);

        this.renderBody();
        this.updateOverlay();
        this.loadPreferences();
        return this;
    }

    /**
     * Shows a loading overlay over the grid until the first {@see setRows} call, so a slow server
     * response leaves a clear "Loading…" state rather than a blank table (or a misleading empty one).
     */
    private updateOverlay(): void {
        if (!this.$overlay || !this.$root) {
            return;
        }
        this.$root.toggleClass('aaxis-grid--loading', !this.loaded);
        if (this.loaded) {
            this.$overlay.attr('hidden', 'hidden');
        } else {
            this.$overlay.removeAttr('hidden');
        }
    }

    private renderHead(): void {
        this.$thead.empty().append(this.buildHeadRow());
    }

    private buildPager(): any {
        const $pager = $('<div/>', {'class': 'aaxis-grid__pager', hidden: 'hidden'});

        const $nav = $('<div/>', {'class': 'aaxis-grid__pager-nav'});

        // Editable page number: a contenteditable span (not an <input>) so it inherits the exact
        // text metrics of the surrounding labels and carries no native widget chrome to fight.
        const $info = $('<span/>', {'class': 'aaxis-grid__pager-info'});
        const $pageLabel = $('<span/>', {'class': 'aaxis-grid__pager-label', text: __('aaxis.common.grid.page_label')});
        const $page = $('<span/>', {
            'class': 'aaxis-grid__pager-page', 'data-role': 'page-number',
            contenteditable: 'true', role: 'textbox', spellcheck: 'false',
            title: __('aaxis.common.grid.go_to_page'), 'aria-label': __('aaxis.common.grid.go_to_page')
        });
        const $infoRest = $('<span/>', {'data-role': 'page-info-rest'});
        $info.append($pageLabel, $page, $infoRest);

        $nav.append(
            $('<button/>', {
                type: 'button', 'class': 'aaxis-grid__pager-btn', 'data-role': 'prev',
                title: __('aaxis.common.grid.prev'), 'aria-label': __('aaxis.common.grid.prev')
            }).append($('<span/>', {'class': 'fa fa-chevron-left', 'aria-hidden': 'true'})),
            $info,
            $('<button/>', {
                type: 'button', 'class': 'aaxis-grid__pager-btn', 'data-role': 'next',
                title: __('aaxis.common.grid.next'), 'aria-label': __('aaxis.common.grid.next')
            }).append($('<span/>', {'class': 'fa fa-chevron-right', 'aria-hidden': 'true'}))
        );

        const $size = $('<label/>', {'class': 'aaxis-grid__pagesize'});
        const $select = $('<select/>', {'class': 'aaxis-grid__pagesize-select', 'data-role': 'page-size'});
        this.pageSizeOptions.forEach(n => $select.append($('<option/>', {value: n, text: String(n)})));
        $select.val(String(this.pageSize));
        $size.append($('<span/>', {text: __('aaxis.common.grid.per_page')}), $select);

        $pager.append($nav, $size);
        return $pager;
    }

    /** Jumps to the given page number (clamped to the valid range). */
    private goToPageInput(value: any): void {
        const n = parseInt(String(value), 10);
        if (isNaN(n)) {
            // Invalid input: restore the displayed page.
            this.renderBody();
            return;
        }
        this.goToPage(n);
    }

    private onPageSizeChange(event: any): void {
        this.pageSize = Number($(event.currentTarget).val()) || 25;
        this.currentPage = 1;
        this.renderBody();
        this.savePreferences();
    }

    /** Navigates to a 1-based page number, clamped to the available range. */
    private goToPage(page: number): void {
        const totalPages = Math.max(1, Math.ceil(this.filteredSortedRows().length / this.pageSize));
        this.currentPage = Math.min(Math.max(1, page), totalPages);
        this.renderBody();
    }

    setRows(rows: any[]): void {
        this.rows = rows || [];
        this.loaded = true;
        this.renderBody();
        this.updateOverlay();
    }

    // --- Header --------------------------------------------------------------

    private buildHeadRow(): any {
        const $tr = $('<tr/>');
        this.visibleColumns().forEach(col => {
            const sortable = col.sortable !== false;
            const $th = $('<th/>', {'data-col-key': col.key});
            if (col.width) {
                $th.css('width', col.width);
            }
            if (col.type === 'number' || col.type === 'boolean') {
                $th.addClass('aaxis-grid__col--center');
            }
            const $inner = $('<span/>', {'class': 'aaxis-grid__th-inner'});
            $inner.append($('<span/>', {'class': 'aaxis-grid__th-label', text: col.label}));

            if (sortable) {
                $th.attr('data-sort-key', col.key).addClass('aaxis-grid__th--sortable');
                $inner.append($('<span/>', {'class': 'aaxis-grid__sort-ind', 'data-role': 'sort-ind'}));
            }
            if (col.filterable !== false) {
                $inner.append($('<button/>', {
                    type: 'button',
                    'class': 'aaxis-grid__filter-btn',
                    'data-role': 'filter-btn',
                    'data-col': col.key,
                    title: __('aaxis.common.grid.filter_toggle'),
                    'aria-label': __('aaxis.common.grid.filter_toggle')
                }).append($('<span/>', {'class': 'fa fa-filter', 'aria-hidden': 'true'})));
            }
            $th.append($inner);
            $tr.append($th);
        });
        if (this.actions.length) {
            $tr.append($('<th/>', {'class': 'aaxis-grid__col-actions', text: __('aaxis.common.grid.actions')}));
        }
        return $tr;
    }

    private onHeaderClick(event: any): void {
        // Ignore clicks that originate on the filter funnel.
        if ($(event.target).closest('[data-role="filter-btn"]').length) {
            return;
        }
        const key = String($(event.currentTarget).attr('data-sort-key'));
        if (this.sortKey === key) {
            this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortKey = key;
            this.sortDir = 'asc';
        }
        this.updateSortIndicators();
        this.currentPage = 1;
        this.renderBody();
    }

    private updateSortIndicators(): void {
        this.$root.find('th[data-sort-key]').each((_i: number, el: any) => {
            const $th = $(el);
            const isActive = $th.attr('data-sort-key') === this.sortKey;
            $th.toggleClass('aaxis-grid__th--active', isActive);
            $th.find('[data-role="sort-ind"]')
                .attr('class', 'aaxis-grid__sort-ind fa '
                    + (isActive ? (this.sortDir === 'asc' ? 'fa-caret-up' : 'fa-caret-down') : ''));
        });
    }

    private updateFilterIndicators(): void {
        this.$root.find('[data-role="filter-btn"]').each((_i: number, el: any) => {
            const $btn = $(el);
            const key = String($btn.attr('data-col'));
            $btn.toggleClass('aaxis-grid__filter-btn--active', !!this.filters[key]);
        });
    }

    // --- Filter popover ------------------------------------------------------

    private operatorsFor(type: GridColumnType | undefined): string[] {
        switch (type) {
            case 'number':
                return ['equals', 'gt', 'lt', 'not_empty'];
            case 'datetime':
                return ['equals', 'after', 'before', 'not_empty'];
            case 'boolean':
                return ['equals', 'not_empty'];
            default:
                return ['contains', 'not_contains', 'starts_with', 'ends_with', 'equals', 'not_empty'];
        }
    }

    private onFilterButton(event: any): void {
        event.preventDefault();
        event.stopPropagation();
        const key = String($(event.currentTarget).attr('data-col'));
        const col = this.columns.find(c => c.key === key) || null;
        if (!col) {
            return;
        }
        if (this.popoverCol && this.popoverCol.key === key && !this.$popover.attr('hidden')) {
            this.closeFilter();
            return;
        }
        this.openFilter(col, $(event.currentTarget));
    }

    private openFilter(col: GridColumn, $btn: any): void {
        this.popoverCol = col;
        const current: ColumnFilter = this.filters[col.key]
            || {operator: this.operatorsFor(col.type)[0], value: '', dateMode: 'datetime'};
        this.renderPopover(col, current);

        // Position under the funnel button, relative to the grid root, clamped to stay on-screen.
        const btnRect = $btn.get(0).getBoundingClientRect();
        const rootRect = this.$root.get(0).getBoundingClientRect();
        const rootWidth = this.$root.get(0).clientWidth;
        const popWidth = this.$popover.outerWidth() || 240;
        let left = btnRect.left - rootRect.left - 8;
        if (left + popWidth > rootWidth) {
            left = Math.max(0, rootWidth - popWidth - 4);
        }
        this.$popover.css({
            top: (btnRect.bottom - rootRect.top + 4) + 'px',
            left: Math.max(0, left) + 'px'
        });
        this.$popover.removeAttr('hidden');
    }

    private closeFilter(): void {
        if (this.$popover) {
            this.$popover.attr('hidden', 'hidden').empty();
        }
        this.popoverCol = null;
    }

    private maybeCloseFilter(event: any): void {
        if (this.$colMenu && !this.$colMenu.attr('hidden')
            && !$(event.target).closest('.aaxis-grid__colmenu, [data-role="columns-settings"]').length) {
            this.closeColumnSettings();
        }
        if (!this.$popover || this.$popover.attr('hidden')) {
            return;
        }
        if ($(event.target).closest('.aaxis-grid__popover, [data-role="filter-btn"]').length) {
            return;
        }
        this.closeFilter();
    }

    private renderPopover(col: GridColumn, filter: ColumnFilter): void {
        this.$popover.empty();

        // For JSON columns, an optional attribute path (dot-separated) to filter a nested value.
        if (col.type === 'json') {
            const $pathRow = $('<div/>', {'class': 'aaxis-grid__popover-row'});
            $pathRow.append($('<input/>', {
                type: 'text', 'class': 'form-control', 'data-role': 'json-path',
                placeholder: __('aaxis.common.grid.json_path_placeholder'), autocomplete: 'off'
            }).val(filter.jsonPath != null ? String(filter.jsonPath) : ''));
            this.$popover.append($pathRow);
        }

        const $opRow = $('<div/>', {'class': 'aaxis-grid__popover-row'});
        const $op = $('<select/>', {'class': 'form-control aaxis-grid__popover-op', 'data-role': 'op'});
        this.operatorsFor(col.type).forEach(op => {
            $op.append($('<option/>', {value: op, text: __('aaxis.common.grid.op.' + op)}));
        });
        $op.val(filter.operator);
        $opRow.append($op);
        this.$popover.append($opRow);

        const $valueWrap = $('<div/>', {'class': 'aaxis-grid__popover-value', 'data-role': 'value-wrap'});
        this.$popover.append($valueWrap);
        this.renderValueControl(col, filter, $valueWrap);

        $op.on('change', () => {
            this.renderValueControl(col, {operator: String($op.val()), value: '', dateMode: filter.dateMode}, $valueWrap);
        });

        const $actions = $('<div/>', {'class': 'aaxis-grid__popover-actions'});
        $actions.append(
            $('<button/>', {type: 'button', 'class': 'btn btn-sm', 'data-role': 'filter-clear', text: __('aaxis.common.grid.filter_clear')}),
            $('<button/>', {type: 'button', 'class': 'btn btn-sm btn-primary', 'data-role': 'filter-apply', text: __('aaxis.common.grid.filter_apply')})
        );
        this.$popover.append($actions);

        $actions.find('[data-role="filter-apply"]').on('click', () => this.applyFilter(col));
        $actions.find('[data-role="filter-clear"]').on('click', () => this.clearFilter(col));
        this.$popover.find('input').on('keydown', (e: any) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.applyFilter(col);
            }
        });
    }

    private renderValueControl(col: GridColumn, filter: ColumnFilter, $wrap: any): void {
        $wrap.empty();
        if (filter.operator === 'not_empty') {
            return;
        }

        if (col.type === 'boolean') {
            $wrap.append($('<select/>', {'class': 'form-control', 'data-role': 'value'}).append(
                $('<option/>', {value: 'yes', text: __('aaxis.common.grid.yes')}),
                $('<option/>', {value: 'no', text: __('aaxis.common.grid.no')})
            ).val(filter.value === 'no' ? 'no' : 'yes'));
            return;
        }

        if (col.type === 'number') {
            $wrap.append($('<input/>', {
                type: 'number', 'class': 'form-control', 'data-role': 'value',
                placeholder: __('aaxis.common.grid.filter_placeholder')
            }).val(filter.value != null ? String(filter.value) : ''));
            return;
        }

        if (col.type === 'datetime') {
            const mode = filter.dateMode || 'datetime';
            const $modeSel = $('<select/>', {'class': 'form-control aaxis-grid__popover-datemode', 'data-role': 'date-mode'}).append(
                $('<option/>', {value: 'datetime', text: __('aaxis.common.grid.date_mode_datetime')}),
                $('<option/>', {value: 'date', text: __('aaxis.common.grid.date_mode_date')})
            ).val(mode);
            const $input = $('<input/>', {
                type: mode === 'date' ? 'date' : 'datetime-local',
                'class': 'form-control', 'data-role': 'value'
            }).val(filter.value != null ? String(filter.value) : '');
            $wrap.append($modeSel, $input);
            $modeSel.on('change', () => {
                const newMode = String($modeSel.val());
                $input.attr('type', newMode === 'date' ? 'date' : 'datetime-local').val('');
            });
            return;
        }

        $wrap.append($('<input/>', {
            type: 'text', 'class': 'form-control', 'data-role': 'value',
            placeholder: __('aaxis.common.grid.filter_placeholder'), autocomplete: 'off'
        }).val(filter.value != null ? String(filter.value) : ''));
    }

    private applyFilter(col: GridColumn): void {
        const operator = String(this.$popover.find('[data-role="op"]').val());
        const $value = this.$popover.find('[data-role="value"]');
        const value = $value.length ? String($value.val() || '') : '';
        const dateMode = this.$popover.find('[data-role="date-mode"]').length
            ? String(this.$popover.find('[data-role="date-mode"]').val())
            : undefined;
        const $path = this.$popover.find('[data-role="json-path"]');
        const jsonPath = $path.length ? String($path.val() || '').trim() : undefined;

        const hasValue = operator === 'not_empty' || value.trim() !== '';
        if (!hasValue && !(jsonPath && jsonPath !== '')) {
            // Nothing to filter by — treat as cleared.
            delete this.filters[col.key];
        } else {
            this.filters[col.key] = {
                operator,
                value,
                dateMode: dateMode as 'date' | 'datetime' | undefined,
                jsonPath: jsonPath || undefined
            };
        }
        this.updateFilterIndicators();
        this.closeFilter();
        this.currentPage = 1;
        this.renderBody();
    }

    private clearFilter(col: GridColumn): void {
        delete this.filters[col.key];
        this.updateFilterIndicators();
        this.closeFilter();
        this.currentPage = 1;
        this.renderBody();
    }

    // --- Filtering / sorting -------------------------------------------------

    private matchFilter(col: GridColumn, rowValue: any, f: ColumnFilter): boolean {
        if (col.type === 'json') {
            return this.matchJson(rowValue, f);
        }
        if (f.operator === 'not_empty') {
            return rowValue !== null && rowValue !== undefined && String(rowValue).trim() !== '';
        }
        if (col.type === 'boolean') {
            return f.operator === 'equals' ? (!!rowValue === (String(f.value) === 'yes')) : true;
        }
        if (col.type === 'number') {
            const rv = Number(rowValue);
            const fv = Number(f.value);
            if (isNaN(fv)) {
                return true;
            }
            if (f.operator === 'gt') return rv > fv;
            if (f.operator === 'lt') return rv < fv;
            if (f.operator === 'equals') return rv === fv;
            return true;
        }
        if (col.type === 'datetime') {
            const rt = this.toTime(rowValue, f.dateMode);
            const ft = this.toTime(f.value, f.dateMode);
            if (rt === null || ft === null) {
                return false;
            }
            if (f.operator === 'after') return rt > ft;
            if (f.operator === 'before') return rt < ft;
            if (f.operator === 'equals') return rt === ft;
            return true;
        }
        const rs = String(rowValue ?? '').toLowerCase();
        const fs = String(f.value ?? '').toLowerCase();
        switch (f.operator) {
            case 'contains': return rs.includes(fs);
            case 'not_contains': return !rs.includes(fs);
            case 'starts_with': return rs.startsWith(fs);
            case 'ends_with': return rs.endsWith(fs);
            case 'equals': return rs === fs;
            default: return true;
        }
    }

    private matchJson(rowValue: any, f: ColumnFilter): boolean {
        const resolved = this.jsonValueAt(rowValue, f.jsonPath);
        if (f.operator === 'not_empty') {
            return resolved !== null && resolved.trim() !== '';
        }
        const rs = (resolved ?? '').toLowerCase();
        const fs = String(f.value ?? '').toLowerCase();
        switch (f.operator) {
            case 'contains': return rs.includes(fs);
            case 'not_contains': return !rs.includes(fs);
            case 'starts_with': return rs.startsWith(fs);
            case 'ends_with': return rs.endsWith(fs);
            case 'equals': return rs === fs;
            default: return true;
        }
    }

    /**
     * Resolves a value inside a JSON payload. With no path, returns the whole JSON text; with a
     * dot-separated path, navigates nested keys and returns that value's text (objects are
     * JSON-stringified). Returns '' when the path is missing.
     */
    private jsonValueAt(rowValue: any, path?: string): string {
        let obj: any = rowValue;
        if (typeof rowValue === 'string') {
            try {
                obj = JSON.parse(rowValue);
            } catch (e) {
                // Not valid JSON — fall back to the raw text.
                return path ? '' : String(rowValue);
            }
        }
        if (!path) {
            return typeof obj === 'object' && obj !== null ? JSON.stringify(obj) : String(obj ?? '');
        }
        let cur = obj;
        const parts = path.split('.');
        for (let i = 0; i < parts.length; i++) {
            if (cur === null || typeof cur !== 'object') {
                return '';
            }
            cur = cur[parts[i]];
        }
        if (cur === null || cur === undefined) {
            return '';
        }
        return typeof cur === 'object' ? JSON.stringify(cur) : String(cur);
    }

    private toTime(value: any, mode?: 'date' | 'datetime'): number | null {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        const d = new Date(value);
        if (isNaN(d.getTime())) {
            return null;
        }
        if (mode === 'date') {
            return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        }
        return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()).getTime();
    }

    private filteredSortedRows(): any[] {
        let rows = this.rows.slice();

        Object.keys(this.filters).forEach(key => {
            const col = this.columns.find(c => c.key === key);
            if (!col) {
                return;
            }
            const f = this.filters[key];
            rows = rows.filter(row => this.matchFilter(col, row[key], f));
        });

        if (this.sortKey) {
            const key = this.sortKey;
            const dir = this.sortDir === 'asc' ? 1 : -1;
            rows.sort((a, b) => {
                const av = a[key];
                const bv = b[key];
                if (typeof av === 'number' && typeof bv === 'number') {
                    return (av - bv) * dir;
                }
                return String(av ?? '').localeCompare(String(bv ?? ''), undefined, {numeric: true}) * dir;
            });
        }

        return rows;
    }

    private renderBody(): void {
        if (!this.$tbody) {
            return;
        }
        this.$tbody.empty();

        // Until the first setRows() call, keep the body blank (no "empty" message): the loading
        // overlay (see updateOverlay) covers the grid instead of a misleading "no records" state.
        if (!this.loaded) {
            this.updatePager(0, 0, 0);
            return;
        }

        const all = this.filteredSortedRows();
        const total = all.length;
        const span = this.visibleColumns().length + (this.actions.length ? 1 : 0);

        if (total === 0) {
            this.$tbody.append($('<tr/>').append(
                $('<td/>', {colspan: span, 'class': 'aaxis-grid__empty text-muted', text: this.emptyText})
            ));
            this.updatePager(0, 0, 0);
            return;
        }

        const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
        if (this.currentPage > totalPages) {
            this.currentPage = totalPages;
        }
        if (this.currentPage < 1) {
            this.currentPage = 1;
        }
        const start = (this.currentPage - 1) * this.pageSize;
        const pageRows = all.slice(start, start + this.pageSize);

        pageRows.forEach(row => this.$tbody.append(this.renderRow(row)));
        this.updatePager(total, start + 1, start + pageRows.length);
    }

    // --- Column visibility / settings ----------------------------------------

    /** Opens (or closes) the column show/hide + reorder menu, anchored to the given element. */
    toggleColumnSettings(anchorEl: any): void {
        if (!this.$colMenu) {
            return;
        }
        if (!this.$colMenu.attr('hidden')) {
            this.closeColumnSettings();
            return;
        }
        this.closeFilter();

        this.$colMenu.empty();
        this.$colMenu.append($('<div/>', {'class': 'aaxis-grid__colmenu-title', text: __('aaxis.common.grid.columns_title')}));
        this.orderedColumns().forEach(col => {
            const $row = $('<div/>', {'class': 'aaxis-grid__colmenu-item', 'data-col-key': col.key})
                .attr('draggable', 'true');
            $row.append($('<span/>', {'class': 'fa fa-bars aaxis-grid__colmenu-handle', 'aria-hidden': 'true'}));
            const $label = $('<label/>', {'class': 'aaxis-grid__colmenu-label'});
            const $cb = $('<input/>', {type: 'checkbox', 'data-col-toggle': col.key});
            $cb.prop('checked', this.hiddenColumns[col.key] !== true);
            if (col.hideable === false) {
                $cb.prop('disabled', true).prop('checked', true);
            }
            $label.append($cb, $('<span/>', {text: col.label}));
            $row.append($label);
            this.$colMenu.append($row);
        });

        const rect = anchorEl.getBoundingClientRect();
        const menuWidth = 240;
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8));
        this.$colMenu.css({position: 'fixed', top: (rect.bottom + 4) + 'px', left: left + 'px', width: menuWidth + 'px'});
        this.$colMenu.removeAttr('hidden');
    }

    private closeColumnSettings(): void {
        if (this.$colMenu) {
            this.$colMenu.attr('hidden', 'hidden');
        }
    }

    private onColumnToggle(event: any): void {
        const $cb = $(event.currentTarget);
        const key = String($cb.attr('data-col-toggle'));
        this.hiddenColumns[key] = !$cb.is(':checked');
        this.renderHead();
        this.renderBody();
        this.savePreferences();
    }

    private onColDragStart(event: any): void {
        this.dragKey = String($(event.currentTarget).attr('data-col-key'));
        $(event.currentTarget).addClass('is-dragging');
        const dt = event.originalEvent.dataTransfer;
        if (dt) {
            dt.effectAllowed = 'move';
            dt.setData('text/plain', this.dragKey);
        }
    }

    private onColDragOver(event: any): void {
        event.preventDefault();
        if (this.dragKey === null) {
            return;
        }
        const $target = $(event.currentTarget);
        const targetKey = String($target.attr('data-col-key'));
        if (targetKey === this.dragKey) {
            return;
        }
        const $dragged = this.$colMenu.find('[data-col-key="' + this.dragKey + '"]');
        const rect = $target.get(0).getBoundingClientRect();
        const after = event.originalEvent.clientY > rect.top + rect.height / 2;
        if (after) {
            $target.after($dragged);
        } else {
            $target.before($dragged);
        }
    }

    private onColDragEnd(): void {
        this.$colMenu.find('.is-dragging').removeClass('is-dragging');
        this.dragKey = null;
        // Read the new order from the menu DOM.
        const newOrder: string[] = [];
        this.$colMenu.find('[data-col-key]').each((_i: number, el: any) => {
            newOrder.push(String(el.getAttribute('data-col-key')));
        });
        if (newOrder.length) {
            this.columnOrder = newOrder;
            this.renderHead();
            this.renderBody();
            this.savePreferences();
        }
    }

    // --- Per-user preferences ------------------------------------------------

    private csrf(): string {
        const name = window.location.protocol === 'https:' ? 'https-_csrf' : '_csrf';
        const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
        return match ? decodeURIComponent(match[1]) : '';
    }

    private loadPreferences(): void {
        if (!this.preferencesUrl) {
            return;
        }
        fetch(this.preferencesUrl, {credentials: 'same-origin'})
            .then(r => r.json())
            .then((data: {state?: {order?: string[]; hidden?: string[]; pageSize?: number}}) => {
                const state = data.state;
                if (!state) {
                    return;
                }
                if (Array.isArray(state.order) && state.order.length) {
                    this.columnOrder = state.order.filter(key => this.columns.some(c => c.key === key));
                    this.columns.forEach(c => {
                        if (this.columnOrder.indexOf(c.key) === -1) {
                            this.columnOrder.push(c.key);
                        }
                    });
                }
                this.hiddenColumns = {};
                (state.hidden || []).forEach(key => {
                    this.hiddenColumns[key] = true;
                });
                if (state.pageSize && this.pageSizeOptions.indexOf(state.pageSize) !== -1) {
                    this.pageSize = state.pageSize;
                    this.$pager.find('[data-role="page-size"]').val(String(this.pageSize));
                }
                this.renderHead();
                this.renderBody();
            })
            .catch(() => { /* preferences are best-effort */ });
    }

    private savePreferences(): void {
        if (!this.preferencesUrl) {
            return;
        }
        const hidden = Object.keys(this.hiddenColumns).filter(key => this.hiddenColumns[key]);
        const state = {order: this.columnOrder, hidden, pageSize: this.pageSize};
        fetch(this.preferencesUrl, {
            method: 'PUT',
            credentials: 'same-origin',
            headers: {'Content-Type': 'application/json', 'X-CSRF-Header': this.csrf()},
            body: JSON.stringify({state})
        }).catch(() => { /* best-effort */ });
    }

    private updatePager(total: number, start: number, end: number): void {
        if (!this.$pager) {
            return;
        }
        if (total === 0) {
            this.$pager.attr('hidden', 'hidden');
            return;
        }
        this.$pager.removeAttr('hidden');

        const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
        this.$pager.find('[data-role="page-number"]').text(String(this.currentPage));
        this.$pager.find('[data-role="page-info-rest"]').text(
            __('aaxis.common.grid.page_of', {total: String(totalPages)})
        );
        this.$pager.find('[data-role="prev"]').prop('disabled', this.currentPage <= 1);
        this.$pager.find('[data-role="next"]').prop('disabled', this.currentPage >= totalPages);
    }

    private renderRow(row: any): any {
        const $tr = $('<tr/>');
        this.visibleColumns().forEach(col => {
            const $td = $('<td/>', {'data-col-key': col.key});
            if (col.type === 'number' || col.type === 'boolean') {
                $td.addClass('aaxis-grid__col--center');
            }
            let copyText = '';
            if (col.render) {
                const out = col.render(row);
                if (typeof out === 'string') {
                    $td.text(out);
                    copyText = out;
                    if (out !== '') {
                        $td.attr('title', out);
                    }
                } else {
                    $td.append(out);
                    if (col.copyValue) {
                        copyText = String(col.copyValue(row) ?? '');
                    }
                }
            } else if (col.type === 'boolean') {
                $td.append($('<span/>', {
                    'class': 'aaxis-grid__badge ' + (row[col.key]
                        ? 'aaxis-grid__badge--on'
                        : 'aaxis-grid__badge--off'),
                    text: row[col.key] ? __('aaxis.common.grid.yes') : __('aaxis.common.grid.no')
                }));
            } else {
                const text = String(row[col.key] ?? '');
                $td.text(text);
                copyText = text;
                if (text !== '') {
                    // Full value on hover.
                    $td.attr('title', text);
                }
            }
            // Click anywhere on the cell copies its value (the preview button stops propagation).
            if (copyText !== '') {
                $td.addClass('aaxis-grid__cell--copyable').attr('data-copy', copyText);
            }
            $tr.append($td);
        });

        if (this.actions.length) {
            const $actions = $('<td/>', {'class': 'aaxis-grid__col-actions'});
            this.actions.forEach(action => {
                const isDisabled = !!action.disabled?.(row);
                const $btn = $('<button/>', {
                    type: 'button',
                    'class': 'aaxis-grid__action'
                        + (action.variant === 'danger' ? ' aaxis-grid__action--danger' : '')
                        + (isDisabled ? ' aaxis-grid__action--disabled' : ''),
                    'data-action': action.key,
                    'data-id': row[this.idKey],
                    title: isDisabled ? (action.disabledTitle || action.label) : action.label,
                    'aria-label': action.label
                }).append($('<span/>', {'class': 'fa ' + action.icon, 'aria-hidden': 'true'}));
                if (isDisabled) {
                    $btn.prop('disabled', true).attr('aria-disabled', 'true');
                }
                $actions.append($btn);
            });
            $tr.append($actions);
        }

        return $tr;
    }

    private onActionClick(event: any): void {
        const $btn = $(event.currentTarget);
        const actionKey = String($btn.attr('data-action'));
        const id = $btn.attr('data-id');
        const row = this.rows.find(r => String(r[this.idKey]) === String(id));
        if (row && this.onAction) {
            this.onAction(actionKey, row);
        }
    }

    private onCellCopy(event: any): void {
        const $td = $(event.currentTarget);
        const text = $td.attr('data-copy') ?? $td.text();
        if (text === '') {
            return;
        }
        this.copyText(text);
    }

    private copyText(text: string): void {
        const done = () => this.showToast(__('aaxis.common.grid.copied'));
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(() => { /* ignore */ });
            return;
        }
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            done();
        } catch (e) {
            // ignore
        }
    }

    private showToast(message: string): void {
        const $toast = $('<div/>', {'class': 'aaxis-grid__toast', text: message});
        $('body').append($toast);
        window.requestAnimationFrame(() => $toast.addClass('is-visible'));
        window.setTimeout(() => {
            $toast.removeClass('is-visible');
            window.setTimeout(() => $toast.remove(), 300);
        }, 1800);
    }

    dispose(): void {
        $(document).off('click.aaxisGrid', this.onDocClick);
        if (this.$root) {
            this.$root.off();
            this.$root.remove();
            this.$root = null;
        }
    }
}
