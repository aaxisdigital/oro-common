import $ from 'jquery';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import type {GridColumn} from '../../../../Resources/js-src/app/widgets/data-grid';
import {applyFilter, columnTexts, mountGrid, openFilter} from './support/data-grid';

const columns: GridColumn[] = [
    {key: 'name', label: 'Name'},
    {key: 'qty', label: 'Qty', type: 'number'},
    {key: 'at', label: 'At', type: 'datetime'},
    {key: 'payload', label: 'Payload', type: 'json'},
    {key: 'note', label: 'Note', sortable: false, filterable: false}
];

const rows = [
    {id: 1, name: 'beta', qty: 5, at: '2026-11-02T10:00:00', payload: {sku: 'B-1'}, note: 'x'},
    {id: 2, name: 'alpha', qty: 30, at: '2026-11-03T09:00:00', payload: {sku: 'A-2'}, note: 'y'},
    {id: 3, name: 'gamma', qty: 4, at: '2026-11-02T18:00:00', payload: {sku: 'G-3'}, note: 'z'}
];

const query = (): Record<string, string> => Object.fromEntries(new URLSearchParams(window.location.search));

function clickHeader(key: string): void {
    $('thead th[data-col-key="' + key + '"]').trigger('click');
}

describe('DataGrid URL state', () => {
    beforeEach(() => {
        window.history.replaceState(null, '', '/admin/list?system=ERP#top');
    });

    afterEach(() => {
        window.history.replaceState(null, '', '/');
    });

    it('writes the sort and the filters into the URL, keeping the other parameters and the hash', () => {
        const {grid} = mountGrid({columns, urlState: true}, rows);

        clickHeader('qty');
        expect(query()).toEqual({system: 'ERP', sort: 'qty'});
        clickHeader('qty');
        expect(query()).toEqual({system: 'ERP', sort: '-qty'});

        openFilter('name');
        applyFilter({op: 'contains', value: 'a: b'});
        openFilter('at');
        applyFilter({op: 'after', mode: 'date', value: '2026-11-02'});
        openFilter('payload');
        applyFilter({op: 'starts_with', path: 'sku', value: 'A'});
        expect(query()).toEqual({
            system: 'ERP', sort: '-qty', 'f.name': 'contains:a: b',
            'f.at': 'after:2026-11-02', 'f.at.mode': 'date', 'f.payload': 'starts_with:A', 'f.payload.path': 'sku'
        });
        expect(window.location.hash).toBe('#top');
        expect(window.location.pathname).toBe('/admin/list');

        // Clearing (popover or programmatic) drops the column's parameters.
        openFilter('name');
        $('.aaxis-grid__popover [data-role="filter-clear"]').trigger('click');
        grid.setFilter('at', null);
        expect(query()).toEqual({system: 'ERP', sort: '-qty', 'f.payload': 'starts_with:A', 'f.payload.path': 'sku'});
    });

    it('restores the sort and the filters from the URL before the first render, marks included', () => {
        window.history.replaceState(null, '', '/admin/list?sort=-name&f.qty=gt:4&f.payload=contains:-&f.payload.path=sku');
        mountGrid({columns, urlState: true}, rows);

        expect(columnTexts('name')).toEqual(['beta', 'alpha']);
        expect($('thead th[data-sort-key="name"]').hasClass('aaxis-grid__th--active')).toBe(true);
        expect($('thead th[data-sort-key="name"] [data-role="sort-ind"]').hasClass('fa-caret-down')).toBe(true);
        expect($('[data-role="filter-btn"][data-col="qty"]').hasClass('aaxis-grid__filter-btn--active')).toBe(true);
        expect($('[data-role="filter-btn"][data-col="name"]').hasClass('aaxis-grid__filter-btn--active')).toBe(false);

        // The popover shows the restored filter.
        openFilter('qty');
        expect($('.aaxis-grid__popover [data-role="op"]').val()).toBe('gt');
        expect($('.aaxis-grid__popover [data-role="value"]').val()).toBe('4');
    });

    it('restores a date-only datetime filter', () => {
        window.history.replaceState(null, '', '/admin/list?f.at=equals:2026-11-02&f.at.mode=date');
        mountGrid({columns, urlState: true}, rows);

        expect(columnTexts('name')).toEqual(['beta', 'gamma']);
    });

    it('ignores unknown columns, unsortable or unfilterable ones and operators the type does not offer', () => {
        window.history.replaceState(null, '', '/admin/list?sort=note&f.note=contains:x&f.ghost=contains:x&f.qty=contains:3&f.name=bogus');
        mountGrid({columns, urlState: true}, rows);

        expect(columnTexts('name')).toEqual(['beta', 'alpha', 'gamma']);
        expect($('.aaxis-grid__th--active')).toHaveLength(0);
        expect($('.aaxis-grid__filter-btn--active')).toHaveLength(0);
    });

    it('leaves the URL alone without the option', () => {
        window.history.replaceState(null, '', '/admin/list?sort=-name');
        mountGrid({columns}, rows);

        expect(columnTexts('name')).toEqual(['beta', 'alpha', 'gamma']);
        clickHeader('qty');
        expect(window.location.search).toBe('?sort=-name');
    });

    it('drops the parameters it owns from the URL when nothing is sorted or filtered anymore', () => {
        window.history.replaceState(null, '', '/admin/list?f.name=equals:alpha');
        const {grid} = mountGrid({columns, urlState: true}, rows);

        grid.setFilter('name', null);

        expect(window.location.search).toBe('');
    });
});
