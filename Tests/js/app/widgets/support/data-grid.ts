import $ from 'jquery';
import {afterEach, vi} from 'vitest';
import DataGrid, {type DataGridOptions} from '../../../../../Resources/js-src/app/widgets/data-grid';

const mounted: DataGrid[] = [];

/** Lets already-settled promise chains (fetch mocks, then/catch/finally) run to completion. */
export async function flush(): Promise<void> {
    for (let i = 0; i < 20; i++) {
        await Promise.resolve();
    }
}

/** Mounts a grid into a fresh container; the grid is disposed automatically after the test. */
export function mountGrid(options: DataGridOptions, rows?: any[]): {grid: DataGrid; $container: any; $root: any} {
    const $container = $('<div/>').appendTo(document.body);
    const grid = new DataGrid(options).mount($container);
    mounted.push(grid);
    if (rows) {
        grid.setRows(rows);
    }

    return {grid, $container, $root: $container.find('.aaxis-grid')};
}

/** Text of every body cell of a column, in row order. */
export function columnTexts(key: string): string[] {
    return $('.aaxis-grid tbody td[data-col-key="' + key + '"]').map((_i, el) => $(el).text()).get();
}

/** Opens a column's filter popover through its funnel button. */
export function openFilter(key: string): void {
    $('.aaxis-grid [data-role="filter-btn"][data-col="' + key + '"]').trigger('click');
}

/** Sets a popover control and applies the filter. */
export function applyFilter(controls: {op?: string; value?: string; mode?: string; path?: string}): void {
    const $pop = $('.aaxis-grid__popover');
    if (controls.path !== undefined) {
        $pop.find('[data-role="json-path"]').val(controls.path);
    }
    if (controls.op !== undefined) {
        $pop.find('[data-role="op"]').val(controls.op).trigger('change');
    }
    if (controls.mode !== undefined) {
        $pop.find('[data-role="date-mode"]').val(controls.mode).trigger('change');
    }
    if (controls.value !== undefined) {
        $pop.find('[data-role="value"]').val(controls.value);
    }
    $pop.find('[data-role="filter-apply"]').trigger('click');
}

afterEach(() => {
    while (mounted.length) {
        mounted.pop()!.dispose();
    }
    $(document).off('.aaxisGrid');
    $(window).off('.aaxisGrid');
    vi.unstubAllGlobals();
});
