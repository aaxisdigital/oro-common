import $ from 'jquery';
import {describe, expect, it, vi} from 'vitest';
import DataGrid, {type GridColumn} from '../../../../Resources/js-src/app/widgets/data-grid';
import {columnTexts, mountGrid, openFilter} from './support/data-grid';

const columns: GridColumn[] = [
    {key: 'name', label: 'Name'},
    {key: 'qty', label: 'Qty', type: 'number'},
    {key: 'note', label: 'Note'}
];

const rows = [
    {id: 1, name: 'Alpha', qty: 3, note: 'x'},
    {id: 2, name: 'Beta', qty: 10, note: 'y'}
];

function anchor(rect: {left: number; bottom: number} = {left: 500, bottom: 40}): HTMLElement {
    const el = $('<button data-role="columns-settings"/>').appendTo(document.body).get(0)!;
    el.getBoundingClientRect = () => rect as DOMRect;

    return el;
}

function menuKeys(): string[] {
    return $('.aaxis-grid__colmenu-item').map((_i, el) => $(el).attr('data-col-key') as string).get();
}

function headerKeys(): string[] {
    return $('thead th[data-col-key]').map((_i, el) => $(el).attr('data-col-key') as string).get();
}

function drag(event: string, target: Element, extra: Record<string, unknown> = {}): any {
    const e = $.Event(event, {originalEvent: {preventDefault: vi.fn(), ...extra}});
    $(target).trigger(e);

    return e;
}

describe('DataGrid column menu', () => {
    it('does nothing before the grid is mounted', () => {
        expect(() => new DataGrid({columns}).toggleColumnSettings(anchor())).not.toThrow();
    });

    it('lists every column, in order, with a checkbox that is checked when the column is visible', () => {
        const {grid} = mountGrid({columns: [...columns.slice(0, 2), {key: 'note', label: 'Note', hidden: true}]}, rows);

        grid.toggleColumnSettings(anchor());

        expect($('.aaxis-grid__colmenu-title').text()).toBe('aaxis.common.grid.columns_title');
        expect(menuKeys()).toEqual(['name', 'qty', 'note']);
        expect($('[data-col-toggle="name"]').prop('checked')).toBe(true);
        expect($('[data-col-toggle="note"]').prop('checked')).toBe(false);
        expect($('.aaxis-grid__colmenu-item').first().attr('draggable')).toBe('true');
        expect($('.aaxis-grid__colmenu-item').first().find('.aaxis-grid__colmenu-label').text()).toBe('Name');
    });

    it('locks columns that cannot be hidden into the checked, disabled state', () => {
        const {grid} = mountGrid({columns: [{key: 'name', label: 'Name', hideable: false, hidden: true}, columns[1]]}, rows);

        grid.toggleColumnSettings(anchor());

        const $cb = $('[data-col-toggle="name"]');
        expect($cb.prop('disabled')).toBe(true);
        expect($cb.prop('checked')).toBe(true);
    });

    it('anchors itself under the trigger as a fixed 240px panel', () => {
        const {grid} = mountGrid({columns}, rows);

        grid.toggleColumnSettings(anchor({left: 500, bottom: 40}));

        const $menu = $('.aaxis-grid__colmenu');
        expect($menu.attr('hidden')).toBeUndefined();
        expect($menu.css('position')).toBe('fixed');
        expect($menu.css('top')).toBe('44px');
        expect($menu.css('left')).toBe('500px');
        expect($menu.css('width')).toBe('240px');
    });

    it.each([
        ['stays inside the right edge of the window', 900, '776px'],
        ['keeps an 8px margin on the left', 0, '8px']
    ])('%s', (_name, left, expected) => {
        const {grid} = mountGrid({columns}, rows);

        grid.toggleColumnSettings(anchor({left, bottom: 0}));

        expect($('.aaxis-grid__colmenu').css('left')).toBe(expected);
    });

    it('closes when toggled a second time', () => {
        const {grid} = mountGrid({columns}, rows);
        const trigger = anchor();
        grid.toggleColumnSettings(trigger);

        grid.toggleColumnSettings(trigger);

        expect($('.aaxis-grid__colmenu').attr('hidden')).toBe('hidden');
    });

    it('closes an open filter popover when it opens', () => {
        const {grid} = mountGrid({columns}, rows);
        openFilter('name');

        grid.toggleColumnSettings(anchor());

        expect($('.aaxis-grid__popover').attr('hidden')).toBe('hidden');
    });

    it('closes on Escape', () => {
        const {grid} = mountGrid({columns}, rows);
        grid.toggleColumnSettings(anchor());

        $(document).trigger($.Event('keydown', {key: 'Escape'}));

        expect($('.aaxis-grid__colmenu').attr('hidden')).toBe('hidden');
    });

    it('closes on a click outside, but not on its own trigger or its own content', () => {
        const {grid} = mountGrid({columns}, rows);
        const trigger = anchor();
        grid.toggleColumnSettings(trigger);

        trigger.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        $('.aaxis-grid__colmenu-title').get(0)!.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        expect($('.aaxis-grid__colmenu').attr('hidden')).toBeUndefined();

        $(document.body).trigger('click');
        expect($('.aaxis-grid__colmenu').attr('hidden')).toBe('hidden');
    });
});

describe('DataGrid column visibility', () => {
    it('removes an unchecked column from the header and every row, and restores it when re-checked', () => {
        const {grid} = mountGrid({columns}, rows);
        grid.toggleColumnSettings(anchor());

        $('[data-col-toggle="qty"]').prop('checked', false).trigger('change');
        expect(headerKeys()).toEqual(['name', 'note']);
        expect($('tbody td[data-col-key="qty"]')).toHaveLength(0);
        expect(columnTexts('name')).toEqual(['Alpha', 'Beta']);

        $('[data-col-toggle="qty"]').prop('checked', true).trigger('change');
        expect(headerKeys()).toEqual(['name', 'qty', 'note']);
        expect(columnTexts('qty')).toEqual(['3', '10']);
    });

    it('lets a column that starts hidden be shown from the menu', () => {
        const {grid} = mountGrid({columns: [...columns.slice(0, 2), {key: 'note', label: 'Note', hidden: true}]}, rows);
        expect(headerKeys()).toEqual(['name', 'qty']);
        grid.toggleColumnSettings(anchor());

        $('[data-col-toggle="note"]').prop('checked', true).trigger('change');

        expect(headerKeys()).toEqual(['name', 'qty', 'note']);
    });

    it('keeps the empty-row colspan in step with the visible columns', () => {
        const {grid} = mountGrid({columns}, []);
        grid.toggleColumnSettings(anchor());

        $('[data-col-toggle="qty"]').prop('checked', false).trigger('change');

        expect($('td.aaxis-grid__empty').attr('colspan')).toBe('2');
    });
});

describe('DataGrid column reordering', () => {
    function openMenu(): DataGrid {
        const {grid} = mountGrid({columns}, rows);
        grid.toggleColumnSettings(anchor());

        return grid;
    }

    function itemRect(key: string): void {
        $('.aaxis-grid__colmenu-item[data-col-key="' + key + '"]').get(0)!.getBoundingClientRect =
            () => ({top: 100, height: 20} as DOMRect);
    }

    it('starts a drag by flagging the item and offering its key to the drop target', () => {
        openMenu();
        const dataTransfer = {effectAllowed: '', setData: vi.fn()};

        drag('dragstart', $('.aaxis-grid__colmenu-item[data-col-key="qty"]').get(0)!, {dataTransfer});

        expect($('.aaxis-grid__colmenu-item[data-col-key="qty"]').hasClass('is-dragging')).toBe(true);
        expect(dataTransfer.effectAllowed).toBe('move');
        expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'qty');
    });

    it('tolerates browsers that give no dataTransfer', () => {
        openMenu();

        expect(() => drag('dragstart', $('.aaxis-grid__colmenu-item').get(0)!, {dataTransfer: null})).not.toThrow();
        expect($('.aaxis-grid__colmenu-item').first().hasClass('is-dragging')).toBe(true);
    });

    it('drops the dragged item after a target when the pointer is in its lower half', () => {
        openMenu();
        drag('dragstart', $('.aaxis-grid__colmenu-item[data-col-key="name"]').get(0)!, {dataTransfer: null});
        itemRect('qty');

        const over = drag('dragover', $('.aaxis-grid__colmenu-item[data-col-key="qty"]').get(0)!, {clientY: 115});

        expect(over.isDefaultPrevented()).toBe(true);
        expect(menuKeys()).toEqual(['qty', 'name', 'note']);
    });

    it('drops the dragged item before a target when the pointer is in its upper half', () => {
        openMenu();
        drag('dragstart', $('.aaxis-grid__colmenu-item[data-col-key="note"]').get(0)!, {dataTransfer: null});
        itemRect('name');

        drag('dragover', $('.aaxis-grid__colmenu-item[data-col-key="name"]').get(0)!, {clientY: 105});

        expect(menuKeys()).toEqual(['note', 'name', 'qty']);
    });

    it('ignores dragging over itself, and dragging that did not start in the menu', () => {
        openMenu();
        itemRect('qty');

        drag('dragover', $('.aaxis-grid__colmenu-item[data-col-key="qty"]').get(0)!, {clientY: 115});
        expect(menuKeys()).toEqual(['name', 'qty', 'note']);

        drag('dragstart', $('.aaxis-grid__colmenu-item[data-col-key="qty"]').get(0)!, {dataTransfer: null});
        drag('dragover', $('.aaxis-grid__colmenu-item[data-col-key="qty"]').get(0)!, {clientY: 115});
        expect(menuKeys()).toEqual(['name', 'qty', 'note']);
    });

    it('lets the browser drop without navigating', () => {
        openMenu();

        const dropped = drag('drop', $('.aaxis-grid__colmenu-item').get(0)!);

        expect(dropped.isDefaultPrevented()).toBe(true);
    });

    it('re-renders header and rows in the new order when the drag ends', () => {
        openMenu();
        drag('dragstart', $('.aaxis-grid__colmenu-item[data-col-key="name"]').get(0)!, {dataTransfer: null});
        itemRect('note');
        drag('dragover', $('.aaxis-grid__colmenu-item[data-col-key="note"]').get(0)!, {clientY: 115});
        expect(headerKeys()).toEqual(['name', 'qty', 'note']);

        drag('dragend', $('.aaxis-grid__colmenu-item[data-col-key="name"]').get(0)!);

        expect(headerKeys()).toEqual(['qty', 'note', 'name']);
        expect($('tbody tr').first().find('td').map((_i, el) => $(el).attr('data-col-key')).get())
            .toEqual(['qty', 'note', 'name']);
        expect($('.aaxis-grid__colmenu-item.is-dragging')).toHaveLength(0);
    });

    it('keeps hidden columns in the saved order', () => {
        const {grid} = mountGrid({columns: [columns[0], {key: 'qty', label: 'Qty', hidden: true}, columns[2]]}, rows);
        grid.toggleColumnSettings(anchor());
        drag('dragstart', $('.aaxis-grid__colmenu-item[data-col-key="note"]').get(0)!, {dataTransfer: null});
        itemRect('name');
        drag('dragover', $('.aaxis-grid__colmenu-item[data-col-key="name"]').get(0)!, {clientY: 101});

        drag('dragend', $('.aaxis-grid__colmenu-item[data-col-key="note"]').get(0)!);

        expect(headerKeys()).toEqual(['note', 'name']);
        $('[data-col-toggle="qty"]').prop('checked', true).trigger('change');
        expect(headerKeys()).toEqual(['note', 'name', 'qty']);
    });
});
