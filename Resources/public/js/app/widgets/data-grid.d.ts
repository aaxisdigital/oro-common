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
/**
 * Reusable, self-contained data grid with per-column header sorting and per-column filtering.
 *
 * Each filterable column header shows a funnel icon (greyed when no filter is set, dark when
 * active). Clicking it opens a popover with a type-aware operator and value control. Sorting and
 * filtering happen client-side.
 */
export default class DataGrid {
    private readonly columns;
    private readonly actions;
    private readonly idKey;
    private readonly emptyText;
    private readonly onAction?;
    private rows;
    private loaded;
    private sortKey;
    private sortDir;
    private filters;
    private hiddenColumns;
    private columnOrder;
    private dragKey;
    private readonly gridKey?;
    private readonly preferencesUrl?;
    private readonly pageSizeOptions;
    private pageSize;
    private currentPage;
    private $root;
    private $thead;
    private $tbody;
    private $popover;
    private $pager;
    private $colMenu;
    private popoverCol;
    private readonly onDocClick;
    constructor(options: DataGridOptions);
    /** Columns in the user-defined display order. */
    private orderedColumns;
    /** Renders the grid into the given container (replaces its content). */
    mount($container: any): this;
    private renderHead;
    private buildPager;
    /** Jumps to the given page number (clamped to the valid range). */
    private goToPageInput;
    private onPageSizeChange;
    /** Navigates to a 1-based page number, clamped to the available range. */
    private goToPage;
    setRows(rows: any[]): void;
    private buildHeadRow;
    private onHeaderClick;
    private updateSortIndicators;
    private updateFilterIndicators;
    private operatorsFor;
    private onFilterButton;
    private openFilter;
    private closeFilter;
    private maybeCloseFilter;
    private renderPopover;
    private renderValueControl;
    private applyFilter;
    private clearFilter;
    private matchFilter;
    private matchJson;
    /**
     * Resolves a value inside a JSON payload. With no path, returns the whole JSON text; with a
     * dot-separated path, navigates nested keys and returns that value's text (objects are
     * JSON-stringified). Returns '' when the path is missing.
     */
    private jsonValueAt;
    private toTime;
    private filteredSortedRows;
    private renderBody;
    private applyColumnVisibility;
    /** Opens (or closes) the column show/hide + reorder menu, anchored to the given element. */
    toggleColumnSettings(anchorEl: any): void;
    private closeColumnSettings;
    private onColumnToggle;
    private onColDragStart;
    private onColDragOver;
    private onColDragEnd;
    private csrf;
    private loadPreferences;
    private savePreferences;
    private updatePager;
    private renderRow;
    private onActionClick;
    private onCellCopy;
    private copyText;
    private showToast;
    dispose(): void;
}
