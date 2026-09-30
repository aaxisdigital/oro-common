import $ from 'jquery';
import __ from 'orotranslation/js/translator';
import Select2View from 'oroform/js/app/views/select2-view';
import 'jquery.select2';

export type FieldType = 'text' | 'password' | 'textarea' | 'number' | 'boolean' | 'select' | 'collection';

export interface SelectOption {
    value: string;
    label: string;
}

export interface FormField {
    key: string;
    label: string;
    type: FieldType;
    required?: boolean;
    placeholder?: string;
    /** Muted helper line rendered under the control (e.g. "a value is stored — leave empty to keep it"). */
    hint?: string;
    /**
     * Renders the control disabled (grayed, not editable). Disabled fields keep their value, are
     * still collected on submit, and skip validation (required/min/max). Prefer this over hiding
     * a field when its relevance depends on another control's value.
     */
    disabled?: boolean;
    /** For 'number': lowest accepted value (validated on submit, also set as the input's min attr). */
    min?: number;
    /** For 'number': highest accepted value (validated on submit, also set as the input's max attr). */
    max?: number;
    /**
     * As a collection sub-field: fixed column width (CSS value, e.g. '180px').
     * As a top-level field sharing a {@see row} with others: the field's flex ratio within the row
     * (the numeric part is used, e.g. '45%' → grow 45), so a row of 45/45/10 splits accordingly.
     */
    width?: string;
    /**
     * Top-level fields with the same non-empty `row` value render side by side on one line (in
     * declaration order). Fields without a `row` (or a row of one) render full width on their own
     * line. Not supported for `collection` fields.
     */
    row?: string | number;
    /** For 'select'. */
    options?: SelectOption[];
    /** For 'collection' (1:N): the sub-fields rendered per row. */
    fields?: FormField[];
    /** For 'collection': label of the add-row button. */
    addLabel?: string;
    /** For 'collection': empty hint. */
    emptyText?: string;
    /**
     * Consecutive top-level fields sharing the same non-empty `tabGroup` render as a tab strip —
     * one tab per field (labelled by {@see tabLabel}, falling back to `label`), only the active
     * tab's field visible. Inactive tabs stay in the DOM, so their values are still collected on
     * submit. A collection inside a tab suppresses its own title (the tab already names it).
     */
    tabGroup?: string;
    /** Label of this field's tab button (defaults to `label`). */
    tabLabel?: string;
}

/** Outcome of a {@see RecordFormOptions.testAction} run. */
export interface TestOutcome {
    success: boolean;
    /** Overall summary line. */
    message?: string;
    /** Optional per-step results, rendered as a checklist above the actions row. */
    steps?: Array<{label: string; success: boolean; message?: string}>;
}

/**
 * Imperative handle passed to {@see RecordFormOptions.onFieldChange} so a consumer can react to a
 * field change — typically to switch a field between control types or load dependent options.
 */
export interface FieldChangeApi {
    /** Current values of all top-level fields (collections collected as arrays of row objects). */
    values(): Record<string, any>;
    /** Replaces the form's field schema and re-renders the body in place, preserving entered values. */
    rebuildFields(fields: FormField[]): void;
    /**
     * For a change that originated inside a collection row: sets another control's value in the
     * SAME row (e.g. auto-fill a sibling). No-op for top-level changes.
     */
    setRowValue(key: string, value: any): void;
}

export interface FieldChangeContext {
    /** The changed field's key (the sub-field key when the change is inside a collection). */
    key: string;
    /** The changed control's current value. */
    value: any;
    /** When the change originates inside a collection, that collection's key; otherwise undefined. */
    collectionKey?: string;
    api: FieldChangeApi;
}

export interface RecordFormOptions {
    title: string;
    subtitle?: string;
    icon?: string;
    /** Initial dialog width (CSS value). Defaults to the stylesheet width. The dialog is resizable. */
    width?: string;
    /** Set to false to remove the resize handle (fixed-size dialog). Defaults to true. */
    resizable?: boolean;
    fields: FormField[];
    values?: Record<string, any>;
    submitLabel?: string;
    onSubmit: (values: Record<string, any>) => Promise<void> | void;
    /**
     * Optional "Test" action rendered on the LEFT side of the Cancel/Submit row. Receives the
     * current form values (collected without validation) and resolves with a {@see TestOutcome};
     * the outcome (overall line + optional step checklist) is shown above the actions row.
     */
    testAction?: {
        label: string;
        onTest: (values: Record<string, any>) => Promise<TestOutcome>;
    };
    /**
     * Called when any field's control fires a `change` (selects, checkboxes, and text inputs on
     * blur). Use the supplied {@see FieldChangeApi} to morph the form — e.g. swap a text field for
     * a combobox, or auto-fill a sibling. Not fired for programmatic value changes made through the
     * API itself.
     */
    onFieldChange?: (ctx: FieldChangeContext) => void;
}

/**
 * Reusable, schema-driven record form rendered in a modal. Every field is shown as a stacked row
 * (label above the control). Supports nested 1:N collections, each rendered as an editable
 * sub-grid with add/remove rows.
 *
 * Create a new instance per open; call open() to show and it cleans itself up on close.
 */
export default class RecordFormModal {
    private readonly opts: RecordFormOptions;
    private $modal: any = null;
    private $alert: any = null;
    private $body: any = null;
    private $testResult: any = null;
    private saving = false;
    private testing = false;
    private selects: any[] = [];
    /** Set while the widget changes a control's value programmatically, to mute onFieldChange. */
    private suppressChange = false;

    constructor(options: RecordFormOptions) {
        this.opts = options;
    }

    open(): void {
        this.$modal = this.build();
        $('body').append(this.$modal);
        this.enhanceSelects(this.$modal);
        window.requestAnimationFrame(() => {
            this.$modal.addClass('is-open');
            this.$modal.find('[data-field]').first().trigger('focus');
        });

        this.$modal.on('click', '[data-role="cancel"]', () => this.close());
        this.$modal.on('click', '[data-role="add-row"]', (e: any) => this.onAddRow(e));
        this.$modal.on('click', '[data-role="remove-row"]', (e: any) => this.onRemoveRow(e));
        this.$modal.on('click', '[data-role="password-toggle"]', (e: any) => this.onTogglePassword(e));
        this.$modal.on('click', '[data-role="tab"]', (e: any) => this.onTabClick(e));
        this.$modal.on('click', '[data-role="test"]', (e: any) => this.onTest(e));
        this.$modal.find('[data-role="form"]').on('submit', (e: any) => this.onSubmit(e));
        this.$modal.find('[data-role="form"]').on('change', '[data-field]', (e: any) => this.handleFieldChange(e));
        $(document).on('keydown.aaxisRecordForm', (e: any) => {
            if (e.key === 'Escape') {
                this.close();
            }
        });
    }

    close(): void {
        if (!this.$modal) {
            return;
        }
        const $m = this.$modal;
        this.$modal = null;
        this.selects.forEach(view => {
            try {
                view.dispose();
            } catch (e) {
                // ignore
            }
        });
        this.selects = [];
        $(document).off('keydown.aaxisRecordForm');
        $m.removeClass('is-open');
        window.setTimeout(() => $m.remove(), 180);
    }

    /**
     * Turns the plain <select> controls into searchable Select2 comboboxes (type-to-filter,
     * supports free-text search). Safe to call repeatedly; only un-enhanced selects are processed.
     */
    private enhanceSelects($scope: any): void {
        $scope.find('select[data-field]').each((_i: number, el: any) => {
            const $select = $(el);
            if ($select.data('aaxis-select2')) {
                return;
            }
            $select.data('aaxis-select2', true);
            try {
                this.selects.push(new Select2View({
                    el: $select,
                    select2Config: {width: '100%', minimumResultsForSearch: 0}
                }));
            } catch (e) {
                // If Select2 is unavailable, leave the native select in place.
            }
        });
    }

    showError(message: string): void {
        if (!this.$alert) {
            return;
        }
        this.$alert.text(message).removeAttr('hidden');
    }

    private clearError(): void {
        if (this.$alert) {
            this.$alert.empty().attr('hidden', 'hidden');
        }
    }

    // --- Build ---------------------------------------------------------------

    private build(): any {
        const $modal = $('<div/>', {'class': 'aaxis-rfm', role: 'dialog', 'aria-modal': 'true'});
        $modal.append($('<div/>', {'class': 'aaxis-rfm__backdrop', 'data-role': 'cancel'}));

        const $dialog = $('<div/>', {'class': 'aaxis-rfm__dialog'});
        if (this.opts.width) {
            $dialog.css('width', this.opts.width);
        }
        if (this.opts.resizable === false) {
            $dialog.addClass('aaxis-rfm__dialog--no-resize');
        }

        const $head = $('<div/>', {'class': 'aaxis-rfm__head'});
        $head.append($('<h2/>', {'class': 'aaxis-rfm__title', text: this.opts.title}));
        if (this.opts.subtitle) {
            $head.append($('<p/>', {'class': 'aaxis-rfm__subtitle', text: this.opts.subtitle}));
        }
        $head.append($('<button/>', {
            type: 'button', 'class': 'aaxis-rfm__close', 'data-role': 'cancel',
            title: __('Cancel'), 'aria-label': __('Cancel')
        }).append($('<span/>', {'class': 'fa fa-times', 'aria-hidden': 'true'})));
        $dialog.append($head);

        const $form = $('<form/>', {'class': 'aaxis-rfm__form', 'data-role': 'form'});

        this.$alert = $('<div/>', {'class': 'aaxis-rfm__alert', role: 'alert', hidden: 'hidden'});
        $form.append(this.$alert);

        this.$body = $('<div/>', {'class': 'aaxis-rfm__body'});
        this.renderBody();
        $form.append(this.$body);

        if (this.opts.testAction) {
            this.$testResult = $('<div/>', {'class': 'aaxis-rfm__test-result', hidden: 'hidden'});
            $form.append(this.$testResult);
        }

        const $actions = $('<div/>', {'class': 'aaxis-rfm__actions'});
        if (this.opts.testAction) {
            $actions.append(
                $('<div/>', {'class': 'aaxis-rfm__test'}).append(
                    $('<button/>', {
                        type: 'button', 'class': 'btn aaxis-rfm__test-btn', 'data-role': 'test',
                        text: this.opts.testAction.label
                    }),
                    $('<span/>', {'class': 'aaxis-rfm__test-status', 'data-role': 'test-status', 'aria-live': 'polite'})
                )
            );
        }
        $actions.append(
            $('<button/>', {type: 'button', 'class': 'btn aaxis-rfm__cancel', 'data-role': 'cancel', text: __('Cancel')}),
            $('<button/>', {
                type: 'submit', 'class': 'btn btn-primary aaxis-rfm__submit', 'data-role': 'submit',
                text: this.opts.submitLabel || __('aaxis.common.grid.submit')
            })
        );
        $form.append($actions);

        $dialog.append($form);
        $modal.append($dialog);
        return $modal;
    }

    /**
     * (Re)renders the field controls into {@see $body} from the current `opts.fields`/`opts.values`.
     * Safe to call repeatedly — used both on first build and on {@see rebuildFields}.
     */
    private renderBody(): void {
        this.$body.empty();
        const values = this.opts.values || {};
        const fields = this.opts.fields;
        let i = 0;
        while (i < fields.length) {
            i = this.appendGroupAt(fields, i, values);
        }
    }

    /**
     * Appends whatever starts at `start` — a tab strip, a shared-row line, or a lone field — and
     * returns the index of the next field still to render.
     */
    private appendGroupAt(fields: FormField[], start: number, values: Record<string, any>): number {
        const field = fields[start];

        // Group consecutive fields sharing the same tabGroup into a tab strip.
        if (field.tabGroup != null && field.tabGroup !== '') {
            const end = RecordFormModal.runEnd(fields, start, f => f.tabGroup === field.tabGroup);
            this.$body.append(this.buildTabs(fields.slice(start, end), values));

            return end;
        }

        // Group consecutive top-level fields that share the same row onto one line.
        if (field.row != null && field.row !== '' && field.type !== 'collection') {
            const end = RecordFormModal.runEnd(
                fields,
                start,
                f => f.type !== 'collection' && f.row === field.row
            );
            if (end - start > 1) {
                const $row = $('<div/>', {'class': 'aaxis-rfm__row'});
                fields.slice(start, end).forEach(f => $row.append(this.buildField(f, values)));
                this.$body.append($row);

                return end;
            }
        }

        this.$body.append(this.buildField(field, values));

        return start + 1;
    }

    /** Index just past the run of consecutive fields after `start` that still satisfy `inRun`. */
    private static runEnd(
        fields: FormField[],
        start: number,
        inRun: (field: FormField) => boolean
    ): number {
        let end = start + 1;
        while (end < fields.length && inRun(fields[end])) {
            end++;
        }

        return end;
    }

    // --- Tabs -----------------------------------------------------------------

    /** One tab per field; inactive panels are hidden but stay in the DOM (values still collect). */
    private buildTabs(group: FormField[], values: Record<string, any>): any {
        const $tabs = $('<div/>', {'class': 'aaxis-rfm__tabs'});
        const $nav = $('<div/>', {'class': 'aaxis-rfm__tab-nav', role: 'tablist'});
        const $panels = $('<div/>', {'class': 'aaxis-rfm__tab-panels'});
        group.forEach((field, index) => {
            $nav.append($('<button/>', {
                type: 'button', role: 'tab', 'data-role': 'tab', 'data-tab-key': field.key,
                'class': 'aaxis-rfm__tab-btn' + (index === 0 ? ' is-active' : ''),
                'aria-selected': index === 0 ? 'true' : 'false',
                text: field.tabLabel || field.label
            }));
            const $panel = $('<div/>', {'class': 'aaxis-rfm__tab-panel', 'data-tab-panel': field.key});
            if (index > 0) {
                $panel.attr('hidden', 'hidden');
            }
            $panel.append(this.buildField(field, values));
            $panels.append($panel);
        });
        $tabs.append($nav, $panels);
        return $tabs;
    }

    private onTabClick(event: any): void {
        event.preventDefault();
        const $button = $(event.currentTarget);
        const key = String($button.attr('data-tab-key'));
        const $tabs = $button.closest('.aaxis-rfm__tabs');
        $tabs.find('[data-role="tab"]').each((_i: number, el: any) => {
            const $el = $(el);
            const active = String($el.attr('data-tab-key')) === key;
            $el.toggleClass('is-active', active).attr('aria-selected', active ? 'true' : 'false');
        });
        $tabs.find('[data-tab-panel]').each((_i: number, el: any) => {
            const $el = $(el);
            if (String($el.attr('data-tab-panel')) === key) {
                $el.removeAttr('hidden');
            } else {
                $el.attr('hidden', 'hidden');
            }
        });
    }

    // --- Reactivity (onFieldChange) ------------------------------------------

    private handleFieldChange(event: any): void {
        if (this.suppressChange || !this.opts.onFieldChange) {
            return;
        }
        const $control = $(event.currentTarget);
        const key = String($control.attr('data-field'));
        const $collection = $control.closest('[data-collection]');
        const collectionKey = $collection.length ? String($collection.attr('data-collection')) : undefined;
        const $row = $control.closest('.aaxis-rfm__collection-row');
        this.opts.onFieldChange({
            key,
            value: this.readControlEl($control),
            collectionKey,
            api: {
                values: () => this.collectValues(),
                rebuildFields: (fields: FormField[]) => this.rebuildFields(fields),
                setRowValue: (k: string, v: any) => this.setRowValue($row, k, v)
            }
        });
    }

    /** Reads a control's value inferring its kind from the DOM (checkbox / number / text-or-select). */
    private readControlEl($control: any): any {
        if (!$control || $control.length === 0) {
            return null;
        }
        if ($control.is(':checkbox')) {
            return $control.is(':checked');
        }
        if ($control.attr('type') === 'number') {
            const raw = String($control.val() || '').trim();
            return raw === '' ? null : Number(raw);
        }
        // Passwords keep their exact value (no trim); the marker attribute survives the show/hide
        // toggle flipping the input's `type` between password and text.
        if ($control.attr('data-type') === 'password') {
            return String($control.val() || '');
        }
        return String($control.val() || '').trim();
    }

    /** Replaces the field schema and re-renders the body, preserving the values entered so far. */
    private rebuildFields(fields: FormField[]): void {
        this.opts.values = this.collectValues();
        this.opts.fields = fields;
        this.disposeSelects();
        this.renderBody();
        this.enhanceSelects(this.$body);
    }

    /** Sets a sibling control's value within a collection row without re-firing onFieldChange. */
    private setRowValue($row: any, key: string, value: any): void {
        if (!$row || $row.length === 0) {
            return;
        }
        const $control = $row.find('[data-field="' + key + '"]').first();
        if ($control.length === 0) {
            return;
        }
        this.suppressChange = true;
        try {
            if ($control.is(':checkbox')) {
                $control.prop('checked', !!value).trigger('change');
            } else {
                // .trigger('change') keeps an enhanced Select2 in sync; suppressChange mutes our own
                // delegated handler so this programmatic set doesn't recurse.
                $control.val(value == null ? '' : String(value)).trigger('change');
            }
        } finally {
            this.suppressChange = false;
        }
    }

    private disposeSelects(): void {
        this.selects.forEach(view => {
            try {
                view.dispose();
            } catch (e) {
                // ignore
            }
        });
        this.selects = [];
    }

    private buildField(field: FormField, values: Record<string, any>): any {
        if (field.type === 'collection') {
            return this.buildCollection(field, Array.isArray(values[field.key]) ? values[field.key] : []);
        }

        const $group = $('<div/>', {'class': 'aaxis-rfm__field'});
        // Inside a multi-field row, `width`'s numeric part is the flex ratio (e.g. '45%' → grow 45).
        if (field.width) {
            $group.css('flex', `${Number.parseFloat(field.width) || 1} 1 0`);
        }
        const $label = $('<label/>', {'class': 'aaxis-rfm__label', text: field.label});
        if (field.required) {
            $label.append($('<span/>', {'class': 'aaxis-rfm__req', text: ' *', 'aria-hidden': 'true'}));
        }
        $group.append($label);
        $group.append(this.buildControl(field, values[field.key]));
        if (field.hint) {
            $group.append($('<span/>', {'class': 'aaxis-rfm__hint', text: field.hint}));
        }
        $group.append($('<span/>', {'class': 'aaxis-rfm__field-error', 'data-role': 'error', 'aria-live': 'polite'}));
        return $group;
    }

    private buildControl(field: FormField, value: any): any {
        const $control = this.buildControlInner(field, value);
        if (field.disabled) {
            // Disable the actual form controls (the wrapper may be a plain div/label).
            const $inner = $control.is('[data-field]') ? $control : $control.find('[data-field]');
            $inner.prop('disabled', true);
            $control.find('[data-role="password-toggle"]').prop('disabled', true);
        }
        return $control;
    }

    private buildControlInner(field: FormField, value: any): any {
        switch (field.type) {
            case 'password': {
                const $wrap = $('<div/>', {'class': 'aaxis-rfm__password'});
                const $input = $('<input/>', {
                    type: 'password', 'class': 'form-control aaxis-rfm__control', 'data-field': field.key,
                    'data-type': 'password', placeholder: field.placeholder || '',
                    autocomplete: 'new-password', spellcheck: false
                }).val(value != null ? String(value) : '');
                const $toggle = $('<button/>', {
                    type: 'button', 'class': 'aaxis-rfm__password-toggle', 'data-role': 'password-toggle',
                    title: __('aaxis.common.grid.show_value'), 'aria-label': __('aaxis.common.grid.show_value')
                }).append($('<span/>', {'class': 'fa fa-eye', 'aria-hidden': 'true'}));
                $wrap.append($input, $toggle);
                return $wrap;
            }
            case 'textarea':
                return $('<textarea/>', {
                    'class': 'form-control aaxis-rfm__control', 'data-field': field.key,
                    rows: 4, placeholder: field.placeholder || '', spellcheck: false
                }).val(value != null ? String(value) : '');
            case 'number': {
                const attrs: Record<string, any> = {
                    type: 'number', 'class': 'form-control aaxis-rfm__control', 'data-field': field.key,
                    placeholder: field.placeholder || ''
                };
                if (field.min != null) {
                    attrs.min = field.min;
                }
                if (field.max != null) {
                    attrs.max = field.max;
                }
                return $('<input/>', attrs).val(value != null ? String(value) : '');
            }
            case 'boolean':
                return this.buildSwitch(field, !!value);
            case 'select': {
                const $select = $('<select/>', {'class': 'form-control aaxis-rfm__control', 'data-field': field.key});
                (field.options || []).forEach(opt => {
                    $select.append($('<option/>', {value: opt.value, text: opt.label}));
                });
                $select.val(value != null ? String(value) : '');
                return $select;
            }
            case 'text':
            default:
                return $('<input/>', {
                    type: 'text', 'class': 'form-control aaxis-rfm__control', 'data-field': field.key,
                    placeholder: field.placeholder || '', autocomplete: 'off', spellcheck: false
                }).val(value != null ? String(value) : '');
        }
    }

    private buildSwitch(field: FormField, checked: boolean): any {
        const $label = $('<label/>', {'class': 'aaxis-rfm__switch'});
        const $input = $('<input/>', {type: 'checkbox', 'data-field': field.key});
        $input.prop('checked', checked);
        $label.append(
            $input,
            $('<span/>', {'class': 'aaxis-rfm__switch-track', 'aria-hidden': 'true'})
                .append($('<span/>', {'class': 'aaxis-rfm__switch-thumb'}))
        );
        return $label;
    }

    // --- Collections (1:N) ---------------------------------------------------

    private buildCollection(field: FormField, rows: any[]): any {
        const $section = $('<div/>', {'class': 'aaxis-rfm__collection', 'data-collection': field.key});
        // Inside a tab the tab button already names the collection — skip the duplicate title.
        if (!field.tabGroup) {
            $section.append($('<h3/>', {'class': 'aaxis-rfm__collection-title', text: field.label}));
        }

        const $table = $('<table/>', {'class': 'aaxis-rfm__collection-table'});
        const $headRow = $('<tr/>');
        (field.fields || []).forEach(sub => {
            const $th = $('<th/>', {text: sub.label});
            if (sub.width) {
                $th.css('width', sub.width);
            }
            if (sub.type === 'boolean') {
                $th.addClass('aaxis-rfm__collection-col--center');
            }
            if (sub.required) {
                $th.append($('<span/>', {'class': 'aaxis-rfm__req', text: ' *', 'aria-hidden': 'true'}));
            }
            $headRow.append($th);
        });
        $headRow.append($('<th/>', {'class': 'aaxis-rfm__collection-actions'}));
        $table.append($('<thead/>').append($headRow));

        const $tbody = $('<tbody/>', {'data-role': 'collection-rows'});
        rows.forEach(row => $tbody.append(this.buildCollectionRow(field, row)));
        $table.append($tbody);
        $section.append($table);

        $section.append($('<button/>', {
            type: 'button', 'class': 'btn btn-sm aaxis-rfm__add-row', 'data-role': 'add-row',
            'data-collection': field.key
        }).append(
            $('<span/>', {'class': 'fa fa-plus', 'aria-hidden': 'true'}),
            $('<span/>', {text: ' ' + (field.addLabel || __('aaxis.common.grid.add_row'))})
        ));

        // Stash the schema on the element for add-row handling.
        ($section.get(0) as any).__field = field;
        return $section;
    }

    private buildCollectionRow(field: FormField, row: any): any {
        const $tr = $('<tr/>', {'class': 'aaxis-rfm__collection-row'});
        (field.fields || []).forEach(sub => {
            const $cell = $('<td/>');
            if (sub.type === 'boolean') {
                $cell.addClass('aaxis-rfm__collection-col--center');
            }
            $cell.append(this.buildControl(sub, row ? row[sub.key] : undefined));
            $tr.append($cell);
        });
        $tr.append($('<td/>', {'class': 'aaxis-rfm__collection-actions'}).append(
            $('<button/>', {
                type: 'button', 'class': 'btn btn-icon aaxis-rfm__action--danger', 'data-role': 'remove-row',
                title: __('Delete'), 'aria-label': __('Delete')
            }).append($('<span/>', {'class': 'fa fa-trash-o', 'aria-hidden': 'true'}))
        ));
        return $tr;
    }

    private onAddRow(event: any): void {
        event.preventDefault();
        // The add-row button itself carries data-collection, so match the section by class (the
        // button is a child of it) to read the schema stashed on the section element.
        const $section = $(event.currentTarget).closest('.aaxis-rfm__collection');
        const field: FormField = ($section.get(0) as any).__field;
        const $row = this.buildCollectionRow(field, {});
        $section.find('[data-role="collection-rows"]').append($row);
        this.enhanceSelects($row);
    }

    private onRemoveRow(event: any): void {
        event.preventDefault();
        $(event.currentTarget).closest('tr').remove();
    }

    // --- Test action ----------------------------------------------------------

    private onTest(event: any): void {
        event.preventDefault();
        if (this.testing || !this.opts.testAction) {
            return;
        }
        this.testing = true;
        const $button = this.$modal.find('[data-role="test"]');
        const $status = this.$modal.find('[data-role="test-status"]');
        $button.prop('disabled', true);
        $status.text(__('aaxis.common.grid.testing'));
        if (this.$testResult) {
            this.$testResult.empty().attr('hidden', 'hidden');
        }
        Promise.resolve()
            .then(() => this.opts.testAction!.onTest(this.collectValues()))
            .then((outcome: TestOutcome) => this.renderTestOutcome(outcome))
            .catch((err: any) => this.renderTestOutcome({
                success: false,
                message: err?.message || __('aaxis.common.grid.test_error')
            }))
            .finally(() => {
                this.testing = false;
                $status.text('');
                if (this.$modal) {
                    this.$modal.find('[data-role="test"]').prop('disabled', false);
                }
            });
    }

    private renderTestOutcome(outcome: TestOutcome): void {
        if (!this.$testResult) {
            return;
        }
        this.$testResult.empty();
        const okIcon = (ok: boolean): any => $('<span/>', {
            'class': 'fa ' + (ok ? 'fa-check-circle' : 'fa-times-circle'), 'aria-hidden': 'true'
        });
        const $overall = $('<div/>', {
            'class': 'aaxis-rfm__test-line ' + (outcome.success ? 'is-ok' : 'is-fail')
        }).append(
            okIcon(outcome.success),
            $('<span/>', {text: ' ' + (outcome.message
                || (outcome.success ? __('aaxis.common.grid.test_success') : __('aaxis.common.grid.test_error')))})
        );
        this.$testResult.append($overall);
        (outcome.steps || []).forEach(step => {
            this.$testResult.append($('<div/>', {
                'class': 'aaxis-rfm__test-step ' + (step.success ? 'is-ok' : 'is-fail')
            }).append(
                okIcon(step.success),
                $('<span/>', {text: ' ' + step.label + (step.message ? ' — ' + step.message : '')})
            ));
        });
        this.$testResult.removeAttr('hidden');
    }

    private onTogglePassword(event: any): void {
        event.preventDefault();
        const $button = $(event.currentTarget);
        const $input = $button.closest('.aaxis-rfm__password').find('input[data-field]').first();
        const show = $input.attr('type') === 'password';
        $input.attr('type', show ? 'text' : 'password');
        const label = show ? __('aaxis.common.grid.hide_value') : __('aaxis.common.grid.show_value');
        $button.attr({title: label, 'aria-label': label});
        $button.find('.fa').toggleClass('fa-eye', !show).toggleClass('fa-eye-slash', show);
    }

    // --- Submit / collect ----------------------------------------------------

    private onSubmit(event: any): void {
        event.preventDefault();
        if (this.saving) {
            return;
        }
        this.clearError();

        const values: Record<string, any> = {};
        let valid = true;

        this.opts.fields.forEach(field => {
            if (field.type === 'collection') {
                values[field.key] = this.collectCollection(field);
                return;
            }
            // Scoped to the field wrappers (like collectValues): a collection sub-field sharing this
            // key would otherwise be read instead when the collection renders first.
            const $control = this.$modal.find('.aaxis-rfm__field [data-field="' + field.key + '"]').first();
            const value = this.readControl(field, $control);
            const error = field.disabled ? '' : this.validateField(field, value);
            if (error !== '') {
                valid = false;
            }
            this.setFieldError($control, error);
            values[field.key] = value;
        });

        if (!valid) {
            return;
        }

        this.saving = true;
        // Busy indicator on the submit button (same treatment as the flow editor's save/debug
        // buttons) — saving goes to the server, so the click needs visible feedback.
        const $submit = this.$modal.find('[data-role="submit"]');
        const $spinner = $('<span/>', {
            'class': 'fa fa-spinner fa-spin aaxis-rfm__submit-spinner', 'aria-hidden': 'true'
        });
        $submit.prop('disabled', true).prepend($spinner);
        Promise.resolve()
            .then(() => this.opts.onSubmit(values))
            .then(() => this.close())
            .catch((err: any) => {
                this.showError((err && err.message) || __('aaxis.common.grid.save_error'));
            })
            .finally(() => {
                this.saving = false;
                $spinner.remove();
                if (this.$modal) {
                    this.$modal.find('[data-role="submit"]').prop('disabled', false);
                }
            });
    }

    /**
     * Collects the current values of all top-level fields (collections as arrays of row objects),
     * without validation. Top-level controls are scoped to their `.aaxis-rfm__field` wrappers so a
     * collection sub-field sharing a key (e.g. `name`) is never mistaken for the top-level one.
     */
    private collectValues(): Record<string, any> {
        const values: Record<string, any> = {};
        this.opts.fields.forEach(field => {
            if (field.type === 'collection') {
                values[field.key] = this.collectCollection(field);
                return;
            }
            const $control = this.$body.find('.aaxis-rfm__field [data-field="' + field.key + '"]').first();
            values[field.key] = this.readControl(field, $control);
        });
        return values;
    }

    private collectCollection(field: FormField): any[] {
        const out: any[] = [];
        this.$modal.find('[data-collection="' + field.key + '"] [data-role="collection-rows"] tr')
            .each((_i: number, tr: any) => {
                const $tr = $(tr);
                const row: Record<string, any> = {};
                let hasValue = false;
                (field.fields || []).forEach(sub => {
                    const $control = $tr.find('[data-field="' + sub.key + '"]').first();
                    const value = this.readControl(sub, $control);
                    row[sub.key] = value;
                    if (!this.isEmpty(value)) {
                        hasValue = true;
                    }
                });
                if (hasValue) {
                    out.push(row);
                }
            });
        return out;
    }

    private readControl(field: FormField, $control: any): any {
        if (!$control || $control.length === 0) {
            return null;
        }
        if (field.type === 'boolean') {
            return $control.is(':checked');
        }
        if (field.type === 'number') {
            const raw = String($control.val() || '').trim();
            return raw === '' ? null : Number(raw);
        }
        if (field.type === 'password') {
            return String($control.val() || '');
        }
        return String($control.val() || '').trim();
    }

    /** Returns the validation error for an (enabled) field's value, or '' when valid. */
    private validateField(field: FormField, value: any): string {
        if (field.required && this.isEmpty(value)) {
            return __('aaxis.common.grid.required');
        }
        if (field.type === 'number' && value != null) {
            const min = field.min;
            const max = field.max;
            if (min != null && max != null && (value < min || value > max)) {
                return __('aaxis.common.grid.number_range', {min: String(min), max: String(max)});
            }
            if (min != null && value < min) {
                return __('aaxis.common.grid.number_min', {min: String(min)});
            }
            if (max != null && value > max) {
                return __('aaxis.common.grid.number_max', {max: String(max)});
            }
        }
        return '';
    }

    private isEmpty(value: any): boolean {
        return value === null || value === undefined || value === '';
    }

    private setFieldError($control: any, message: string): void {
        const $error = $control.closest('.aaxis-rfm__field').find('[data-role="error"]');
        $error.text(message);
        $control.toggleClass('error', message !== '');
    }
}
