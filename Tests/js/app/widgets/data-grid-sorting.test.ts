import $ from 'jquery';
import {describe, expect, it} from 'vitest';
import type {GridColumn} from '../../../../Resources/js-src/app/widgets/data-grid';
import {columnTexts, mountGrid} from './support/data-grid';

const columns: GridColumn[] = [
    {key: 'name', label: 'Name'},
    {key: 'qty', label: 'Qty', type: 'number'},
    {key: 'note', label: 'Note', sortable: false}
];

const rows = [
    {id: 1, name: 'item10', qty: 5, note: 'c'},
    {id: 2, name: 'Item2', qty: 30, note: 'a'},
    {id: 3, name: 'item1', qty: 4, note: 'b'}
];

function clickHeader(key: string): void {
    $('thead th[data-col-key="' + key + '"]').trigger('click');
}

describe('DataGrid sorting', () => {
    it('keeps the incoming order until a header is clicked', () => {
        mountGrid({columns}, rows);

        expect(columnTexts('name')).toEqual(['item10', 'Item2', 'item1']);
    });

    it('sorts ascending on the first click of a header, comparing embedded numbers numerically', () => {
        mountGrid({columns}, rows);

        clickHeader('name');

        expect(columnTexts('name')).toEqual(['item1', 'Item2', 'item10']);
    });

    it('toggles to descending on the second click and back to ascending on the third', () => {
        mountGrid({columns}, rows);

        clickHeader('name');
        clickHeader('name');
        expect(columnTexts('name')).toEqual(['item10', 'Item2', 'item1']);

        clickHeader('name');
        expect(columnTexts('name')).toEqual(['item1', 'Item2', 'item10']);
    });

    it('compares numeric values as numbers, not as text', () => {
        mountGrid({columns}, rows);

        clickHeader('qty');
        expect(columnTexts('qty')).toEqual(['4', '5', '30']);

        clickHeader('qty');
        expect(columnTexts('qty')).toEqual(['30', '5', '4']);
    });

    it('restarts ascending when another column is chosen', () => {
        mountGrid({columns}, rows);
        clickHeader('name');
        clickHeader('name');

        clickHeader('qty');

        expect(columnTexts('qty')).toEqual(['4', '5', '30']);
    });

    it('sorts missing values as empty text, ahead of everything else', () => {
        mountGrid({columns}, [
            {id: 1, name: 'b'},
            {id: 2, name: null},
            {id: 3, name: 'a'}
        ]);

        clickHeader('name');

        expect(columnTexts('name')).toEqual(['', 'a', 'b']);
    });

    it('does not sort columns declared unsortable', () => {
        mountGrid({columns}, rows);

        clickHeader('note');

        expect(columnTexts('note')).toEqual(['c', 'a', 'b']);
    });

    it('shows the direction on the active header only', () => {
        mountGrid({columns}, rows);

        clickHeader('name');
        expect($('th[data-col-key="name"]').hasClass('aaxis-grid__th--active')).toBe(true);
        expect($('th[data-col-key="name"] [data-role="sort-ind"]').attr('class')).toBe('aaxis-grid__sort-ind fa fa-caret-up');
        expect($('th[data-col-key="qty"]').hasClass('aaxis-grid__th--active')).toBe(false);
        expect($('th[data-col-key="qty"] [data-role="sort-ind"]').attr('class')).toBe('aaxis-grid__sort-ind fa ');

        clickHeader('name');
        expect($('th[data-col-key="name"] [data-role="sort-ind"]').attr('class')).toBe('aaxis-grid__sort-ind fa fa-caret-down');

        clickHeader('qty');
        expect($('th[data-col-key="name"]').hasClass('aaxis-grid__th--active')).toBe(false);
        expect($('th[data-col-key="qty"]').hasClass('aaxis-grid__th--active')).toBe(true);
    });

    it('does not sort when the click landed on the filter funnel', () => {
        mountGrid({columns}, rows);

        $('th[data-col-key="name"] [data-role="filter-btn"]').trigger('click');

        expect(columnTexts('name')).toEqual(['item10', 'Item2', 'item1']);
        expect($('th[data-col-key="name"]').hasClass('aaxis-grid__th--active')).toBe(false);
    });

    it('returns to the first page whenever the order changes', () => {
        const many = Array.from({length: 30}, (_v, i) => ({id: i, name: 'row' + String(i).padStart(2, '0'), qty: i}));
        mountGrid({columns, pageSize: 10}, many);
        $('[data-role="next"]').trigger('click');
        expect($('[data-role="page-number"]').text()).toBe('2');

        clickHeader('name');

        expect($('[data-role="page-number"]').text()).toBe('1');
        expect(columnTexts('name')[0]).toBe('row00');
    });
});
