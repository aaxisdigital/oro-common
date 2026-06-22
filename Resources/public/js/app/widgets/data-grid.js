import $ from 'jquery';
import __ from 'orotranslation/js/translator';
/**
 * Reusable, self-contained data grid with per-column header sorting and per-column filtering.
 *
 * Each filterable column header shows a funnel icon (greyed when no filter is set, dark when
 * active). Clicking it opens a popover with a type-aware operator and value control. Sorting and
 * filtering happen client-side.
 */
export default class DataGrid {
    constructor(options) {
        this.rows = [];
        this.loaded = false;
        this.sortKey = null;
        this.sortDir = 'asc';
        this.filters = {};
        this.hiddenColumns = {};
        this.columnOrder = [];
        this.dragKey = null;
        this.currentPage = 1;
        this.$root = null;
        this.$thead = null;
        this.$tbody = null;
        this.$popover = null;
        this.$pager = null;
        this.$colMenu = null;
        this.popoverCol = null;
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
        this.onDocClick = (e) => this.maybeCloseFilter(e);
    }
    /** Columns in the user-defined display order. */
    orderedColumns() {
        const byKey = {};
        this.columns.forEach(col => {
            byKey[col.key] = col;
        });
        const ordered = [];
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
    /** Renders the grid into the given container (replaces its content). */
    mount($container) {
        this.$root = $('<div/>', { 'class': 'aaxis-grid' });
        const $table = $('<table/>', { 'class': 'aaxis-grid__table grid table-hover table-bordered table' });
        this.$thead = $('<thead/>');
        this.$tbody = $('<tbody/>');
        $table.append(this.$thead, this.$tbody);
        this.renderHead();
        this.$popover = $('<div/>', { 'class': 'aaxis-grid__popover', hidden: 'hidden' });
        this.$colMenu = $('<div/>', { 'class': 'aaxis-grid__colmenu', hidden: 'hidden' });
        this.$pager = this.buildPager();
        this.$root.append(this.$pager, $table, this.$popover, this.$colMenu);
        $container.empty().append(this.$root);
        this.$root.on('click', 'th[data-sort-key]', (e) => this.onHeaderClick(e));
        this.$root.on('click', '[data-role="filter-btn"]', (e) => this.onFilterButton(e));
        this.$root.on('click', '[data-action]', (e) => this.onActionClick(e));
        this.$root.on('click', 'td.aaxis-grid__cell--copyable', (e) => this.onCellCopy(e));
        this.$colMenu.on('change', '[data-col-toggle]', (e) => this.onColumnToggle(e));
        this.$colMenu.on('dragstart', '[data-col-key]', (e) => this.onColDragStart(e));
        this.$colMenu.on('dragover', '[data-col-key]', (e) => this.onColDragOver(e));
        this.$colMenu.on('drop', '[data-col-key]', (e) => e.preventDefault());
        this.$colMenu.on('dragend', '[data-col-key]', () => this.onColDragEnd());
        this.$pager.on('change', '[data-role="page-size"]', (e) => this.onPageSizeChange(e));
        this.$pager.on('click', '[data-role="prev"]', () => this.goToPage(this.currentPage - 1));
        this.$pager.on('click', '[data-role="next"]', () => this.goToPage(this.currentPage + 1));
        this.$pager.on('keydown', '[data-role="page-number"]', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.goToPageInput($(e.currentTarget).text());
                $(e.currentTarget).trigger('blur');
            }
        });
        this.$pager.on('focusout', '[data-role="page-number"]', (e) => this.goToPageInput($(e.currentTarget).text()));
        $(document).on('click.aaxisGrid', this.onDocClick);
        this.renderBody();
        this.applyColumnVisibility();
        this.loadPreferences();
        return this;
    }
    renderHead() {
        this.$thead.empty().append(this.buildHeadRow());
    }
    buildPager() {
        const $pager = $('<div/>', { 'class': 'aaxis-grid__pager', hidden: 'hidden' });
        const $nav = $('<div/>', { 'class': 'aaxis-grid__pager-nav' });
        // Editable page number: a contenteditable span (not an <input>) so it inherits the exact
        // text metrics of the surrounding labels and carries no native widget chrome to fight.
        const $info = $('<span/>', { 'class': 'aaxis-grid__pager-info' });
        const $pageLabel = $('<span/>', { 'class': 'aaxis-grid__pager-label', text: __('aaxis.common.grid.page_label') });
        const $page = $('<span/>', {
            'class': 'aaxis-grid__pager-page', 'data-role': 'page-number',
            contenteditable: 'true', role: 'textbox', spellcheck: 'false',
            title: __('aaxis.common.grid.go_to_page'), 'aria-label': __('aaxis.common.grid.go_to_page')
        });
        const $infoRest = $('<span/>', { 'data-role': 'page-info-rest' });
        $info.append($pageLabel, $page, $infoRest);
        $nav.append($('<button/>', {
            type: 'button', 'class': 'aaxis-grid__pager-btn', 'data-role': 'prev',
            title: __('aaxis.common.grid.prev'), 'aria-label': __('aaxis.common.grid.prev')
        }).append($('<span/>', { 'class': 'fa fa-chevron-left', 'aria-hidden': 'true' })), $info, $('<button/>', {
            type: 'button', 'class': 'aaxis-grid__pager-btn', 'data-role': 'next',
            title: __('aaxis.common.grid.next'), 'aria-label': __('aaxis.common.grid.next')
        }).append($('<span/>', { 'class': 'fa fa-chevron-right', 'aria-hidden': 'true' })));
        const $size = $('<label/>', { 'class': 'aaxis-grid__pagesize' });
        const $select = $('<select/>', { 'class': 'aaxis-grid__pagesize-select', 'data-role': 'page-size' });
        this.pageSizeOptions.forEach(n => $select.append($('<option/>', { value: n, text: String(n) })));
        $select.val(String(this.pageSize));
        $size.append($('<span/>', { text: __('aaxis.common.grid.per_page') }), $select);
        $pager.append($nav, $size);
        return $pager;
    }
    /** Jumps to the given page number (clamped to the valid range). */
    goToPageInput(value) {
        const n = parseInt(String(value), 10);
        if (isNaN(n)) {
            // Invalid input: restore the displayed page.
            this.renderBody();
            return;
        }
        this.goToPage(n);
    }
    onPageSizeChange(event) {
        this.pageSize = Number($(event.currentTarget).val()) || 25;
        this.currentPage = 1;
        this.renderBody();
        this.savePreferences();
    }
    /** Navigates to a 1-based page number, clamped to the available range. */
    goToPage(page) {
        const totalPages = Math.max(1, Math.ceil(this.filteredSortedRows().length / this.pageSize));
        this.currentPage = Math.min(Math.max(1, page), totalPages);
        this.renderBody();
    }
    setRows(rows) {
        this.rows = rows || [];
        this.loaded = true;
        this.renderBody();
        this.applyColumnVisibility();
    }
    // --- Header --------------------------------------------------------------
    buildHeadRow() {
        const $tr = $('<tr/>');
        this.orderedColumns().forEach(col => {
            const sortable = col.sortable !== false;
            const $th = $('<th/>', { 'data-col-key': col.key });
            if (col.width) {
                $th.css('width', col.width);
            }
            if (col.type === 'number' || col.type === 'boolean') {
                $th.addClass('aaxis-grid__col--center');
            }
            const $inner = $('<span/>', { 'class': 'aaxis-grid__th-inner' });
            $inner.append($('<span/>', { 'class': 'aaxis-grid__th-label', text: col.label }));
            if (sortable) {
                $th.attr('data-sort-key', col.key).addClass('aaxis-grid__th--sortable');
                $inner.append($('<span/>', { 'class': 'aaxis-grid__sort-ind', 'data-role': 'sort-ind' }));
            }
            if (col.filterable !== false) {
                $inner.append($('<button/>', {
                    type: 'button',
                    'class': 'aaxis-grid__filter-btn',
                    'data-role': 'filter-btn',
                    'data-col': col.key,
                    title: __('aaxis.common.grid.filter_toggle'),
                    'aria-label': __('aaxis.common.grid.filter_toggle')
                }).append($('<span/>', { 'class': 'fa fa-filter', 'aria-hidden': 'true' })));
            }
            $th.append($inner);
            $tr.append($th);
        });
        if (this.actions.length) {
            $tr.append($('<th/>', { 'class': 'aaxis-grid__col-actions', text: __('aaxis.common.grid.actions') }));
        }
        return $tr;
    }
    onHeaderClick(event) {
        // Ignore clicks that originate on the filter funnel.
        if ($(event.target).closest('[data-role="filter-btn"]').length) {
            return;
        }
        const key = String($(event.currentTarget).attr('data-sort-key'));
        if (this.sortKey === key) {
            this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
        }
        else {
            this.sortKey = key;
            this.sortDir = 'asc';
        }
        this.updateSortIndicators();
        this.currentPage = 1;
        this.renderBody();
    }
    updateSortIndicators() {
        this.$root.find('th[data-sort-key]').each((_i, el) => {
            const $th = $(el);
            const isActive = $th.attr('data-sort-key') === this.sortKey;
            $th.toggleClass('aaxis-grid__th--active', isActive);
            $th.find('[data-role="sort-ind"]')
                .attr('class', 'aaxis-grid__sort-ind fa '
                + (isActive ? (this.sortDir === 'asc' ? 'fa-caret-up' : 'fa-caret-down') : ''));
        });
    }
    updateFilterIndicators() {
        this.$root.find('[data-role="filter-btn"]').each((_i, el) => {
            const $btn = $(el);
            const key = String($btn.attr('data-col'));
            $btn.toggleClass('aaxis-grid__filter-btn--active', !!this.filters[key]);
        });
    }
    // --- Filter popover ------------------------------------------------------
    operatorsFor(type) {
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
    onFilterButton(event) {
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
    openFilter(col, $btn) {
        this.popoverCol = col;
        const current = this.filters[col.key]
            || { operator: this.operatorsFor(col.type)[0], value: '', dateMode: 'datetime' };
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
    closeFilter() {
        if (this.$popover) {
            this.$popover.attr('hidden', 'hidden').empty();
        }
        this.popoverCol = null;
    }
    maybeCloseFilter(event) {
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
    renderPopover(col, filter) {
        this.$popover.empty();
        // For JSON columns, an optional attribute path (dot-separated) to filter a nested value.
        if (col.type === 'json') {
            const $pathRow = $('<div/>', { 'class': 'aaxis-grid__popover-row' });
            $pathRow.append($('<input/>', {
                type: 'text', 'class': 'form-control', 'data-role': 'json-path',
                placeholder: __('aaxis.common.grid.json_path_placeholder'), autocomplete: 'off'
            }).val(filter.jsonPath != null ? String(filter.jsonPath) : ''));
            this.$popover.append($pathRow);
        }
        const $opRow = $('<div/>', { 'class': 'aaxis-grid__popover-row' });
        const $op = $('<select/>', { 'class': 'form-control aaxis-grid__popover-op', 'data-role': 'op' });
        this.operatorsFor(col.type).forEach(op => {
            $op.append($('<option/>', { value: op, text: __('aaxis.common.grid.op.' + op) }));
        });
        $op.val(filter.operator);
        $opRow.append($op);
        this.$popover.append($opRow);
        const $valueWrap = $('<div/>', { 'class': 'aaxis-grid__popover-value', 'data-role': 'value-wrap' });
        this.$popover.append($valueWrap);
        this.renderValueControl(col, filter, $valueWrap);
        $op.on('change', () => {
            this.renderValueControl(col, { operator: String($op.val()), value: '', dateMode: filter.dateMode }, $valueWrap);
        });
        const $actions = $('<div/>', { 'class': 'aaxis-grid__popover-actions' });
        $actions.append($('<button/>', { type: 'button', 'class': 'btn btn-sm', 'data-role': 'filter-clear', text: __('aaxis.common.grid.filter_clear') }), $('<button/>', { type: 'button', 'class': 'btn btn-sm btn-primary', 'data-role': 'filter-apply', text: __('aaxis.common.grid.filter_apply') }));
        this.$popover.append($actions);
        $actions.find('[data-role="filter-apply"]').on('click', () => this.applyFilter(col));
        $actions.find('[data-role="filter-clear"]').on('click', () => this.clearFilter(col));
        this.$popover.find('input').on('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.applyFilter(col);
            }
        });
    }
    renderValueControl(col, filter, $wrap) {
        $wrap.empty();
        if (filter.operator === 'not_empty') {
            return;
        }
        if (col.type === 'boolean') {
            $wrap.append($('<select/>', { 'class': 'form-control', 'data-role': 'value' }).append($('<option/>', { value: 'yes', text: __('aaxis.common.grid.yes') }), $('<option/>', { value: 'no', text: __('aaxis.common.grid.no') })).val(filter.value === 'no' ? 'no' : 'yes'));
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
            const $modeSel = $('<select/>', { 'class': 'form-control aaxis-grid__popover-datemode', 'data-role': 'date-mode' }).append($('<option/>', { value: 'datetime', text: __('aaxis.common.grid.date_mode_datetime') }), $('<option/>', { value: 'date', text: __('aaxis.common.grid.date_mode_date') })).val(mode);
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
    applyFilter(col) {
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
        }
        else {
            this.filters[col.key] = {
                operator,
                value,
                dateMode: dateMode,
                jsonPath: jsonPath || undefined
            };
        }
        this.updateFilterIndicators();
        this.closeFilter();
        this.currentPage = 1;
        this.renderBody();
    }
    clearFilter(col) {
        delete this.filters[col.key];
        this.updateFilterIndicators();
        this.closeFilter();
        this.currentPage = 1;
        this.renderBody();
    }
    // --- Filtering / sorting -------------------------------------------------
    matchFilter(col, rowValue, f) {
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
            if (f.operator === 'gt')
                return rv > fv;
            if (f.operator === 'lt')
                return rv < fv;
            if (f.operator === 'equals')
                return rv === fv;
            return true;
        }
        if (col.type === 'datetime') {
            const rt = this.toTime(rowValue, f.dateMode);
            const ft = this.toTime(f.value, f.dateMode);
            if (rt === null || ft === null) {
                return false;
            }
            if (f.operator === 'after')
                return rt > ft;
            if (f.operator === 'before')
                return rt < ft;
            if (f.operator === 'equals')
                return rt === ft;
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
    matchJson(rowValue, f) {
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
    jsonValueAt(rowValue, path) {
        let obj = rowValue;
        if (typeof rowValue === 'string') {
            try {
                obj = JSON.parse(rowValue);
            }
            catch (e) {
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
    toTime(value, mode) {
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
    filteredSortedRows() {
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
                return String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true }) * dir;
            });
        }
        return rows;
    }
    renderBody() {
        if (!this.$tbody) {
            return;
        }
        this.$tbody.empty();
        // Until the first setRows() call, keep the body blank (no "empty" message) so the
        // consumer's loading indicator is shown instead of a misleading "no records" state.
        if (!this.loaded) {
            this.updatePager(0, 0, 0);
            return;
        }
        const all = this.filteredSortedRows();
        const total = all.length;
        const span = this.columns.length + (this.actions.length ? 1 : 0);
        if (total === 0) {
            this.$tbody.append($('<tr/>').append($('<td/>', { colspan: span, 'class': 'aaxis-grid__empty text-muted', text: this.emptyText })));
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
        this.applyColumnVisibility();
    }
    // --- Column visibility / settings ----------------------------------------
    applyColumnVisibility() {
        if (!this.$root) {
            return;
        }
        this.columns.forEach(col => {
            const hidden = this.hiddenColumns[col.key] === true;
            this.$root.find('[data-col-key="' + col.key + '"]').toggleClass('aaxis-grid__cell--hidden', hidden);
        });
    }
    /** Opens (or closes) the column show/hide + reorder menu, anchored to the given element. */
    toggleColumnSettings(anchorEl) {
        if (!this.$colMenu) {
            return;
        }
        if (!this.$colMenu.attr('hidden')) {
            this.closeColumnSettings();
            return;
        }
        this.closeFilter();
        this.$colMenu.empty();
        this.$colMenu.append($('<div/>', { 'class': 'aaxis-grid__colmenu-title', text: __('aaxis.common.grid.columns_title') }));
        this.orderedColumns().forEach(col => {
            const $row = $('<div/>', { 'class': 'aaxis-grid__colmenu-item', 'data-col-key': col.key })
                .attr('draggable', 'true');
            $row.append($('<span/>', { 'class': 'fa fa-bars aaxis-grid__colmenu-handle', 'aria-hidden': 'true' }));
            const $label = $('<label/>', { 'class': 'aaxis-grid__colmenu-label' });
            const $cb = $('<input/>', { type: 'checkbox', 'data-col-toggle': col.key });
            $cb.prop('checked', this.hiddenColumns[col.key] !== true);
            if (col.hideable === false) {
                $cb.prop('disabled', true).prop('checked', true);
            }
            $label.append($cb, $('<span/>', { text: col.label }));
            $row.append($label);
            this.$colMenu.append($row);
        });
        const rect = anchorEl.getBoundingClientRect();
        const menuWidth = 240;
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8));
        this.$colMenu.css({ position: 'fixed', top: (rect.bottom + 4) + 'px', left: left + 'px', width: menuWidth + 'px' });
        this.$colMenu.removeAttr('hidden');
    }
    closeColumnSettings() {
        if (this.$colMenu) {
            this.$colMenu.attr('hidden', 'hidden');
        }
    }
    onColumnToggle(event) {
        const $cb = $(event.currentTarget);
        const key = String($cb.attr('data-col-toggle'));
        this.hiddenColumns[key] = !$cb.is(':checked');
        this.applyColumnVisibility();
        this.savePreferences();
    }
    onColDragStart(event) {
        this.dragKey = String($(event.currentTarget).attr('data-col-key'));
        $(event.currentTarget).addClass('is-dragging');
        const dt = event.originalEvent.dataTransfer;
        if (dt) {
            dt.effectAllowed = 'move';
            dt.setData('text/plain', this.dragKey);
        }
    }
    onColDragOver(event) {
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
        }
        else {
            $target.before($dragged);
        }
    }
    onColDragEnd() {
        this.$colMenu.find('.is-dragging').removeClass('is-dragging');
        this.dragKey = null;
        // Read the new order from the menu DOM.
        const newOrder = [];
        this.$colMenu.find('[data-col-key]').each((_i, el) => {
            newOrder.push(String(el.getAttribute('data-col-key')));
        });
        if (newOrder.length) {
            this.columnOrder = newOrder;
            this.renderHead();
            this.renderBody();
            this.applyColumnVisibility();
            this.savePreferences();
        }
    }
    // --- Per-user preferences ------------------------------------------------
    csrf() {
        const name = window.location.protocol === 'https:' ? 'https-_csrf' : '_csrf';
        const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
        return match ? decodeURIComponent(match[1]) : '';
    }
    loadPreferences() {
        if (!this.preferencesUrl) {
            return;
        }
        fetch(this.preferencesUrl, { credentials: 'same-origin' })
            .then(r => r.json())
            .then((data) => {
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
            this.applyColumnVisibility();
        })
            .catch(() => { });
    }
    savePreferences() {
        if (!this.preferencesUrl) {
            return;
        }
        const hidden = Object.keys(this.hiddenColumns).filter(key => this.hiddenColumns[key]);
        const state = { order: this.columnOrder, hidden, pageSize: this.pageSize };
        fetch(this.preferencesUrl, {
            method: 'PUT',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Header': this.csrf() },
            body: JSON.stringify({ state })
        }).catch(() => { });
    }
    updatePager(total, start, end) {
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
        this.$pager.find('[data-role="page-info-rest"]').text(__('aaxis.common.grid.page_of', { total: String(totalPages) }));
        this.$pager.find('[data-role="prev"]').prop('disabled', this.currentPage <= 1);
        this.$pager.find('[data-role="next"]').prop('disabled', this.currentPage >= totalPages);
    }
    renderRow(row) {
        const $tr = $('<tr/>');
        this.orderedColumns().forEach(col => {
            const $td = $('<td/>', { 'data-col-key': col.key });
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
                }
                else {
                    $td.append(out);
                    if (col.copyValue) {
                        copyText = String(col.copyValue(row) ?? '');
                    }
                }
            }
            else if (col.type === 'boolean') {
                $td.append($('<span/>', {
                    'class': 'aaxis-grid__badge ' + (row[col.key]
                        ? 'aaxis-grid__badge--on'
                        : 'aaxis-grid__badge--off'),
                    text: row[col.key] ? __('aaxis.common.grid.yes') : __('aaxis.common.grid.no')
                }));
            }
            else {
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
            const $actions = $('<td/>', { 'class': 'aaxis-grid__col-actions' });
            this.actions.forEach(action => {
                $actions.append($('<button/>', {
                    type: 'button',
                    'class': 'aaxis-grid__action'
                        + (action.variant === 'danger' ? ' aaxis-grid__action--danger' : ''),
                    'data-action': action.key,
                    'data-id': row[this.idKey],
                    title: action.label,
                    'aria-label': action.label
                }).append($('<span/>', { 'class': 'fa ' + action.icon, 'aria-hidden': 'true' })));
            });
            $tr.append($actions);
        }
        return $tr;
    }
    onActionClick(event) {
        const $btn = $(event.currentTarget);
        const actionKey = String($btn.attr('data-action'));
        const id = $btn.attr('data-id');
        const row = this.rows.find(r => String(r[this.idKey]) === String(id));
        if (row && this.onAction) {
            this.onAction(actionKey, row);
        }
    }
    onCellCopy(event) {
        const $td = $(event.currentTarget);
        const text = $td.attr('data-copy') ?? $td.text();
        if (text === '') {
            return;
        }
        this.copyText(text);
    }
    copyText(text) {
        const done = () => this.showToast(__('aaxis.common.grid.copied'));
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(() => { });
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
        }
        catch (e) {
            // ignore
        }
    }
    showToast(message) {
        const $toast = $('<div/>', { 'class': 'aaxis-grid__toast', text: message });
        $('body').append($toast);
        window.requestAnimationFrame(() => $toast.addClass('is-visible'));
        window.setTimeout(() => {
            $toast.removeClass('is-visible');
            window.setTimeout(() => $toast.remove(), 300);
        }, 1800);
    }
    dispose() {
        $(document).off('click.aaxisGrid', this.onDocClick);
        if (this.$root) {
            this.$root.off();
            this.$root.remove();
            this.$root = null;
        }
    }
}
