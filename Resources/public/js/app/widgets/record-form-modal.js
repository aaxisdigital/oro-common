import $ from 'jquery';
import __ from 'orotranslation/js/translator';
import Select2View from 'oroform/js/app/views/select2-view';
import 'jquery.select2';
/**
 * Reusable, schema-driven record form rendered in a modal. Every field is shown as a stacked row
 * (label above the control). Supports nested 1:N collections, each rendered as an editable
 * sub-grid with add/remove rows.
 *
 * Create a new instance per open; call open() to show and it cleans itself up on close.
 */
export default class RecordFormModal {
    constructor(options) {
        this.$modal = null;
        this.$alert = null;
        this.saving = false;
        this.selects = [];
        this.opts = options;
    }
    open() {
        this.$modal = this.build();
        $('body').append(this.$modal);
        this.enhanceSelects(this.$modal);
        window.requestAnimationFrame(() => {
            this.$modal.addClass('is-open');
            this.$modal.find('[data-field]').first().trigger('focus');
        });
        this.$modal.on('click', '[data-role="cancel"]', () => this.close());
        this.$modal.on('click', '[data-role="add-row"]', (e) => this.onAddRow(e));
        this.$modal.on('click', '[data-role="remove-row"]', (e) => this.onRemoveRow(e));
        this.$modal.find('[data-role="form"]').on('submit', (e) => this.onSubmit(e));
        $(document).on('keydown.aaxisRecordForm', (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        });
    }
    close() {
        if (!this.$modal) {
            return;
        }
        const $m = this.$modal;
        this.$modal = null;
        this.selects.forEach(view => {
            try {
                view.dispose();
            }
            catch (e) {
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
    enhanceSelects($scope) {
        $scope.find('select[data-field]').each((_i, el) => {
            const $select = $(el);
            if ($select.data('aaxis-select2')) {
                return;
            }
            $select.data('aaxis-select2', true);
            try {
                this.selects.push(new Select2View({
                    el: $select,
                    select2Config: { width: '100%', minimumResultsForSearch: 0 }
                }));
            }
            catch (e) {
                // If Select2 is unavailable, leave the native select in place.
            }
        });
    }
    showError(message) {
        if (!this.$alert) {
            return;
        }
        this.$alert.text(message).removeAttr('hidden');
    }
    clearError() {
        if (this.$alert) {
            this.$alert.empty().attr('hidden', 'hidden');
        }
    }
    // --- Build ---------------------------------------------------------------
    build() {
        const $modal = $('<div/>', { 'class': 'aaxis-rfm', role: 'dialog', 'aria-modal': 'true' });
        $modal.append($('<div/>', { 'class': 'aaxis-rfm__backdrop', 'data-role': 'cancel' }));
        const $dialog = $('<div/>', { 'class': 'aaxis-rfm__dialog' });
        if (this.opts.width) {
            $dialog.css('width', this.opts.width);
        }
        const $head = $('<div/>', { 'class': 'aaxis-rfm__head' });
        $head.append($('<h2/>', { 'class': 'aaxis-rfm__title', text: this.opts.title }));
        if (this.opts.subtitle) {
            $head.append($('<p/>', { 'class': 'aaxis-rfm__subtitle', text: this.opts.subtitle }));
        }
        $head.append($('<button/>', {
            type: 'button', 'class': 'aaxis-rfm__close', 'data-role': 'cancel',
            title: __('Cancel'), 'aria-label': __('Cancel')
        }).append($('<span/>', { 'class': 'fa fa-times', 'aria-hidden': 'true' })));
        $dialog.append($head);
        const $form = $('<form/>', { 'class': 'aaxis-rfm__form', 'data-role': 'form' });
        this.$alert = $('<div/>', { 'class': 'aaxis-rfm__alert', role: 'alert', hidden: 'hidden' });
        $form.append(this.$alert);
        const $bodyWrap = $('<div/>', { 'class': 'aaxis-rfm__body' });
        const values = this.opts.values || {};
        const fields = this.opts.fields;
        for (let i = 0; i < fields.length;) {
            const field = fields[i];
            // Group consecutive top-level fields that share the same row onto one line.
            if (field.row != null && field.row !== '' && field.type !== 'collection') {
                const group = [field];
                let j = i + 1;
                while (j < fields.length && fields[j].type !== 'collection' && fields[j].row === field.row) {
                    group.push(fields[j]);
                    j++;
                }
                if (group.length > 1) {
                    const $row = $('<div/>', { 'class': 'aaxis-rfm__row' });
                    group.forEach(f => $row.append(this.buildField(f, values)));
                    $bodyWrap.append($row);
                    i = j;
                    continue;
                }
            }
            $bodyWrap.append(this.buildField(field, values));
            i++;
        }
        $form.append($bodyWrap);
        const $actions = $('<div/>', { 'class': 'aaxis-rfm__actions' });
        $actions.append($('<button/>', { type: 'button', 'class': 'btn aaxis-rfm__cancel', 'data-role': 'cancel', text: __('Cancel') }), $('<button/>', {
            type: 'submit', 'class': 'btn btn-primary aaxis-rfm__submit', 'data-role': 'submit',
            text: this.opts.submitLabel || __('aaxis.common.grid.submit')
        }));
        $form.append($actions);
        $dialog.append($form);
        $modal.append($dialog);
        return $modal;
    }
    buildField(field, values) {
        if (field.type === 'collection') {
            return this.buildCollection(field, Array.isArray(values[field.key]) ? values[field.key] : []);
        }
        const $group = $('<div/>', { 'class': 'aaxis-rfm__field' });
        // Inside a multi-field row, `width`'s numeric part is the flex ratio (e.g. '45%' → grow 45).
        if (field.width) {
            $group.css('flex', `${Number.parseFloat(field.width) || 1} 1 0`);
        }
        const $label = $('<label/>', { 'class': 'aaxis-rfm__label', text: field.label });
        if (field.required) {
            $label.append($('<span/>', { 'class': 'aaxis-rfm__req', text: ' *', 'aria-hidden': 'true' }));
        }
        $group.append($label);
        $group.append(this.buildControl(field, values[field.key]));
        $group.append($('<span/>', { 'class': 'aaxis-rfm__field-error', 'data-role': 'error', 'aria-live': 'polite' }));
        return $group;
    }
    buildControl(field, value) {
        switch (field.type) {
            case 'textarea':
                return $('<textarea/>', {
                    'class': 'form-control aaxis-rfm__control', 'data-field': field.key,
                    rows: 4, placeholder: field.placeholder || '', spellcheck: false
                }).val(value != null ? String(value) : '');
            case 'number':
                return $('<input/>', {
                    type: 'number', 'class': 'form-control aaxis-rfm__control', 'data-field': field.key,
                    placeholder: field.placeholder || ''
                }).val(value != null ? String(value) : '');
            case 'boolean':
                return this.buildSwitch(field, !!value);
            case 'select': {
                const $select = $('<select/>', { 'class': 'form-control aaxis-rfm__control', 'data-field': field.key });
                (field.options || []).forEach(opt => {
                    $select.append($('<option/>', { value: opt.value, text: opt.label }));
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
    buildSwitch(field, checked) {
        const $label = $('<label/>', { 'class': 'aaxis-rfm__switch' });
        const $input = $('<input/>', { type: 'checkbox', 'data-field': field.key });
        $input.prop('checked', checked);
        $label.append($input, $('<span/>', { 'class': 'aaxis-rfm__switch-track', 'aria-hidden': 'true' })
            .append($('<span/>', { 'class': 'aaxis-rfm__switch-thumb' })));
        return $label;
    }
    // --- Collections (1:N) ---------------------------------------------------
    buildCollection(field, rows) {
        const $section = $('<div/>', { 'class': 'aaxis-rfm__collection', 'data-collection': field.key });
        $section.append($('<h3/>', { 'class': 'aaxis-rfm__collection-title', text: field.label }));
        const $table = $('<table/>', { 'class': 'aaxis-rfm__collection-table' });
        const $headRow = $('<tr/>');
        (field.fields || []).forEach(sub => {
            const $th = $('<th/>', { text: sub.label });
            if (sub.width) {
                $th.css('width', sub.width);
            }
            if (sub.type === 'boolean') {
                $th.addClass('aaxis-rfm__collection-col--center');
            }
            if (sub.required) {
                $th.append($('<span/>', { 'class': 'aaxis-rfm__req', text: ' *', 'aria-hidden': 'true' }));
            }
            $headRow.append($th);
        });
        $headRow.append($('<th/>', { 'class': 'aaxis-rfm__collection-actions' }));
        $table.append($('<thead/>').append($headRow));
        const $tbody = $('<tbody/>', { 'data-role': 'collection-rows' });
        rows.forEach(row => $tbody.append(this.buildCollectionRow(field, row)));
        $table.append($tbody);
        $section.append($table);
        $section.append($('<button/>', {
            type: 'button', 'class': 'btn btn-sm aaxis-rfm__add-row', 'data-role': 'add-row',
            'data-collection': field.key
        }).append($('<span/>', { 'class': 'fa fa-plus', 'aria-hidden': 'true' }), $('<span/>', { text: ' ' + (field.addLabel || __('aaxis.common.grid.add_row')) })));
        // Stash the schema on the element for add-row handling.
        $section.get(0).__field = field;
        return $section;
    }
    buildCollectionRow(field, row) {
        const $tr = $('<tr/>', { 'class': 'aaxis-rfm__collection-row' });
        (field.fields || []).forEach(sub => {
            const $cell = $('<td/>');
            if (sub.type === 'boolean') {
                $cell.addClass('aaxis-rfm__collection-col--center');
            }
            $cell.append(this.buildControl(sub, row ? row[sub.key] : undefined));
            $tr.append($cell);
        });
        $tr.append($('<td/>', { 'class': 'aaxis-rfm__collection-actions' }).append($('<button/>', {
            type: 'button', 'class': 'btn btn-icon aaxis-rfm__action--danger', 'data-role': 'remove-row',
            title: __('Delete'), 'aria-label': __('Delete')
        }).append($('<span/>', { 'class': 'fa fa-trash-o', 'aria-hidden': 'true' }))));
        return $tr;
    }
    onAddRow(event) {
        event.preventDefault();
        // The add-row button itself carries data-collection, so match the section by class (the
        // button is a child of it) to read the schema stashed on the section element.
        const $section = $(event.currentTarget).closest('.aaxis-rfm__collection');
        const field = $section.get(0).__field;
        const $row = this.buildCollectionRow(field, {});
        $section.find('[data-role="collection-rows"]').append($row);
        this.enhanceSelects($row);
    }
    onRemoveRow(event) {
        event.preventDefault();
        $(event.currentTarget).closest('tr').remove();
    }
    // --- Submit / collect ----------------------------------------------------
    onSubmit(event) {
        event.preventDefault();
        if (this.saving) {
            return;
        }
        this.clearError();
        const values = {};
        let valid = true;
        this.opts.fields.forEach(field => {
            if (field.type === 'collection') {
                values[field.key] = this.collectCollection(field);
                return;
            }
            const $control = this.$modal.find('[data-field="' + field.key + '"]').first();
            const value = this.readControl(field, $control);
            if (field.required && this.isEmpty(value)) {
                valid = false;
                this.setFieldError($control, __('aaxis.common.grid.required'));
            }
            else {
                this.setFieldError($control, '');
            }
            values[field.key] = value;
        });
        if (!valid) {
            return;
        }
        this.saving = true;
        this.$modal.find('[data-role="submit"]').prop('disabled', true);
        Promise.resolve()
            .then(() => this.opts.onSubmit(values))
            .then(() => this.close())
            .catch((err) => {
            this.showError((err && err.message) || __('aaxis.common.grid.save_error'));
        })
            .finally(() => {
            this.saving = false;
            if (this.$modal) {
                this.$modal.find('[data-role="submit"]').prop('disabled', false);
            }
        });
    }
    collectCollection(field) {
        const out = [];
        this.$modal.find('[data-collection="' + field.key + '"] [data-role="collection-rows"] tr')
            .each((_i, tr) => {
            const $tr = $(tr);
            const row = {};
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
    readControl(field, $control) {
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
        return String($control.val() || '').trim();
    }
    isEmpty(value) {
        return value === null || value === undefined || value === '';
    }
    setFieldError($control, message) {
        const $error = $control.closest('.aaxis-rfm__field').find('[data-role="error"]');
        $error.text(message);
        $control.toggleClass('error', message !== '');
    }
}
