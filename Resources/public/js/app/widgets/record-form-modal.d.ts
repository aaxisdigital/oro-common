import 'jquery.select2';
export type FieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'collection';
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
}
export interface RecordFormOptions {
    title: string;
    subtitle?: string;
    icon?: string;
    /** Initial dialog width (CSS value). Defaults to the stylesheet width. The dialog is resizable. */
    width?: string;
    fields: FormField[];
    values?: Record<string, any>;
    submitLabel?: string;
    onSubmit: (values: Record<string, any>) => Promise<void> | void;
}
/**
 * Reusable, schema-driven record form rendered in a modal. Every field is shown as a stacked row
 * (label above the control). Supports nested 1:N collections, each rendered as an editable
 * sub-grid with add/remove rows.
 *
 * Create a new instance per open; call open() to show and it cleans itself up on close.
 */
export default class RecordFormModal {
    private readonly opts;
    private $modal;
    private $alert;
    private saving;
    private selects;
    constructor(options: RecordFormOptions);
    open(): void;
    close(): void;
    /**
     * Turns the plain <select> controls into searchable Select2 comboboxes (type-to-filter,
     * supports free-text search). Safe to call repeatedly; only un-enhanced selects are processed.
     */
    private enhanceSelects;
    showError(message: string): void;
    private clearError;
    private build;
    private buildField;
    private buildControl;
    private buildSwitch;
    private buildCollection;
    private buildCollectionRow;
    private onAddRow;
    private onRemoveRow;
    private onSubmit;
    private collectCollection;
    private readControl;
    private isEmpty;
    private setFieldError;
}
