import $ from 'jquery';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {GridColumn} from '../../../../Resources/js-src/app/widgets/data-grid';
import {columnTexts, flush, mountGrid} from './support/data-grid';

const URL = '/aaxis/common/grid-preference/things';

const columns: GridColumn[] = [
    {key: 'name', label: 'Name'},
    {key: 'qty', label: 'Qty', type: 'number'},
    {key: 'note', label: 'Note'}
];

const rows = Array.from({length: 30}, (_v, i) => ({id: i + 1, name: 'n' + i, qty: i, note: 'x'}));

function headerKeys(): string[] {
    return $('thead th[data-col-key]').map((_i, el) => $(el).attr('data-col-key') as string).get();
}

function stubFetch(state: unknown, ok = true): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
            return Promise.resolve({ok: true});
        }

        return ok ? Promise.resolve({json: () => Promise.resolve({state})}) : Promise.reject(new Error('offline'));
    });
    vi.stubGlobal('fetch', fetchMock);

    return fetchMock;
}

function saves(fetchMock: ReturnType<typeof vi.fn>): any[][] {
    return fetchMock.mock.calls.filter(call => call[1]?.method === 'PUT');
}

function clearCookies(): void {
    document.cookie = '_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    document.cookie = 'https-_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

afterEach(clearCookies);

describe('DataGrid stored layout: loading', () => {
    it('does not touch the network without a preferences URL', () => {
        const fetchMock = stubFetch({});
        mountGrid({columns}, rows);

        $('[data-role="page-size"]').val('10').trigger('change');

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('asks the server for the user layout on mount, with the session cookie', () => {
        const fetchMock = stubFetch({});

        mountGrid({columns, preferencesUrl: URL}, rows);

        expect(fetchMock).toHaveBeenCalledWith(URL, {credentials: 'same-origin'});
    });

    it('applies the saved column order and hidden columns', async () => {
        stubFetch({order: ['note', 'name', 'qty'], hidden: ['qty']});
        mountGrid({columns, preferencesUrl: URL}, rows);

        await flush();

        expect(headerKeys()).toEqual(['note', 'name']);
        expect($('tbody tr').first().find('td').map((_i, el) => $(el).attr('data-col-key')).get()).toEqual(['note', 'name']);
    });

    it('drops saved keys of columns that no longer exist and appends new columns at the end', async () => {
        stubFetch({order: ['ghost', 'qty'], hidden: []});
        mountGrid({columns, preferencesUrl: URL}, rows);

        await flush();

        expect(headerKeys()).toEqual(['qty', 'name', 'note']);
    });

    it('keeps the default order when the saved order is empty', async () => {
        stubFetch({order: [], hidden: ['note']});
        mountGrid({columns, preferencesUrl: URL}, rows);

        await flush();

        expect(headerKeys()).toEqual(['name', 'qty']);
    });

    it('restores a saved page size that is one of the offered choices', async () => {
        stubFetch({pageSize: 10});
        mountGrid({columns, preferencesUrl: URL}, rows);

        await flush();

        expect($('[data-role="page-size"]').val()).toBe('10');
        expect(columnTexts('name')).toHaveLength(10);
    });

    it('ignores a saved page size that is not offered', async () => {
        stubFetch({pageSize: 33});
        mountGrid({columns, preferencesUrl: URL}, rows);

        await flush();

        expect($('[data-role="page-size"]').val()).toBe('25');
        expect(columnTexts('name')).toHaveLength(25);
    });

    it('changes nothing when the server has no stored layout', async () => {
        const fetchMock = vi.fn(() => Promise.resolve({json: () => Promise.resolve({})}));
        vi.stubGlobal('fetch', fetchMock);
        mountGrid({columns: [columns[0], {key: 'qty', label: 'Qty', hidden: true}], preferencesUrl: URL}, rows);

        await flush();

        expect(headerKeys()).toEqual(['name']);
        expect(columnTexts('name')).toHaveLength(25);
    });

    it('carries on with defaults when the request fails', async () => {
        stubFetch({}, false);
        mountGrid({columns, preferencesUrl: URL}, rows);

        await flush();

        expect(headerKeys()).toEqual(['name', 'qty', 'note']);
    });

    it('carries on with defaults when the response is not JSON', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({json: () => Promise.reject(new SyntaxError('bad json'))})));
        mountGrid({columns, preferencesUrl: URL}, rows);

        await flush();

        expect(headerKeys()).toEqual(['name', 'qty', 'note']);
    });
});

describe('DataGrid stored layout: saving', () => {
    function anchor(): HTMLElement {
        const el = $('<button/>').appendTo(document.body).get(0)!;
        el.getBoundingClientRect = () => ({left: 0, bottom: 0} as DOMRect);

        return el;
    }

    it('saves the layout with the CSRF token when the page size changes', async () => {
        document.cookie = '_csrf=tok%20en; path=/';
        const fetchMock = stubFetch({});
        mountGrid({columns, preferencesUrl: URL}, rows);
        await flush();

        $('[data-role="page-size"]').val('50').trigger('change');

        const [[url, init]] = saves(fetchMock);
        expect(url).toBe(URL);
        expect(init.credentials).toBe('same-origin');
        expect(init.headers).toEqual({'Content-Type': 'application/json', 'X-CSRF-Header': 'tok en'});
        expect(JSON.parse(init.body)).toEqual({state: {order: ['name', 'qty', 'note'], hidden: [], pageSize: 50}});
    });

    it('saves the hidden columns when one is toggled off', async () => {
        const fetchMock = stubFetch({});
        const {grid} = mountGrid({columns, preferencesUrl: URL}, rows);
        await flush();
        grid.toggleColumnSettings(anchor());

        $('[data-col-toggle="qty"]').prop('checked', false).trigger('change');

        expect(JSON.parse(saves(fetchMock)[0][1].body).state.hidden).toEqual(['qty']);
    });

    it('does not list a column as hidden once it is shown again', async () => {
        const fetchMock = stubFetch({});
        const {grid} = mountGrid({columns, preferencesUrl: URL}, rows);
        await flush();
        grid.toggleColumnSettings(anchor());
        $('[data-col-toggle="qty"]').prop('checked', false).trigger('change');

        $('[data-col-toggle="qty"]').prop('checked', true).trigger('change');

        expect(JSON.parse(saves(fetchMock)[1][1].body).state.hidden).toEqual([]);
    });

    it('saves the new order when a column drag ends', async () => {
        const fetchMock = stubFetch({});
        const {grid} = mountGrid({columns, preferencesUrl: URL}, rows);
        await flush();
        grid.toggleColumnSettings(anchor());
        const $items = $('.aaxis-grid__colmenu-item');
        $items.filter('[data-col-key="note"]').insertBefore($items.first());

        $items.first().trigger('dragend');

        expect(JSON.parse(saves(fetchMock)[0][1].body).state.order).toEqual(['note', 'name', 'qty']);
    });

    it('sends an empty CSRF header when there is no cookie', async () => {
        const fetchMock = stubFetch({});
        mountGrid({columns, preferencesUrl: URL}, rows);
        await flush();

        $('[data-role="page-size"]').val('10').trigger('change');

        expect(saves(fetchMock)[0][1].headers['X-CSRF-Header']).toBe('');
    });

    it('reads the https-prefixed CSRF cookie on secure pages', async () => {
        vi.stubGlobal('location', {protocol: 'https:', assign: vi.fn()});
        document.cookie = '_csrf=plain; path=/';
        document.cookie = 'https-_csrf=secure; path=/';
        const fetchMock = stubFetch({});
        mountGrid({columns, preferencesUrl: URL}, rows);
        await flush();

        $('[data-role="page-size"]').val('10').trigger('change');

        expect(saves(fetchMock)[0][1].headers['X-CSRF-Header']).toBe('secure');
    });

    it('does not mistake a cookie whose name merely ends in _csrf for the token', async () => {
        document.cookie = 'other_csrf=nope; path=/';
        const fetchMock = stubFetch({});
        mountGrid({columns, preferencesUrl: URL}, rows);
        await flush();

        $('[data-role="page-size"]').val('10').trigger('change');

        expect(saves(fetchMock)[0][1].headers['X-CSRF-Header']).toBe('');
        document.cookie = 'other_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    });

    it('shrugs off a failed save', async () => {
        const fetchMock = vi.fn((_url: string, init?: RequestInit) => init?.method === 'PUT'
            ? Promise.reject(new Error('offline'))
            : Promise.resolve({json: () => Promise.resolve({})}));
        vi.stubGlobal('fetch', fetchMock);
        mountGrid({columns, preferencesUrl: URL}, rows);
        await flush();

        $('[data-role="page-size"]').val('10').trigger('change');
        await flush();

        expect(saves(fetchMock)).toHaveLength(1);
        expect(columnTexts('name')).toHaveLength(10);
    });
});
