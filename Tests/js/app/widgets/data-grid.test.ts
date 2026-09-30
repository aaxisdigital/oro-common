import $ from 'jquery';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import DataGrid, {navigateTo, type GridColumn} from '../../../../Resources/js-src/app/widgets/data-grid';
import {columnTexts, flush, mountGrid} from './support/data-grid';

const columns: GridColumn[] = [
    {key: 'name', label: 'Name'},
    {key: 'qty', label: 'Qty', type: 'number'},
    {key: 'active', label: 'Active', type: 'boolean'}
];

const rows = [
    {id: 1, name: 'Alpha', qty: 3, active: true},
    {id: 2, name: 'Beta', qty: 10, active: false}
];

describe('navigateTo', () => {
    it.each([
        ['ctrl', {ctrlKey: true}],
        ['meta', {metaKey: true}]
    ])('opens a new noopener tab on %s+click', (_name, init) => {
        const open = vi.spyOn(window, 'open').mockImplementation(() => null);
        const assign = vi.fn();
        vi.stubGlobal('location', {assign});

        navigateTo('/somewhere', new MouseEvent('click', init));

        expect(open).toHaveBeenCalledWith('/somewhere', '_blank', 'noopener');
        expect(assign).not.toHaveBeenCalled();
    });

    it.each([
        ['a plain click', new MouseEvent('click')],
        ['no event', undefined],
        ['a null event', null]
    ])('replaces the current page on %s', (_name, event) => {
        const open = vi.spyOn(window, 'open').mockImplementation(() => null);
        const assign = vi.fn();
        vi.stubGlobal('location', {assign});

        navigateTo('/somewhere', event);

        expect(assign).toHaveBeenCalledWith('/somewhere');
        expect(open).not.toHaveBeenCalled();
    });
});

describe('DataGrid rendering', () => {
    it('mounts the grid skeleton into the container, replacing its previous content', () => {
        const $container = $('<div><p class="old">old</p></div>').appendTo(document.body);

        const grid = new DataGrid({columns});
        expect(grid.mount($container)).toBe(grid);

        expect($container.find('.old')).toHaveLength(0);
        const $root = $container.children('.aaxis-grid');
        expect($root).toHaveLength(1);
        expect($root.find('.aaxis-grid__pager')).toHaveLength(1);
        expect($root.find('.aaxis-grid__scroll > table.aaxis-grid__table thead')).toHaveLength(1);
        expect($root.find('.aaxis-grid__popover').attr('hidden')).toBe('hidden');
        expect($root.find('.aaxis-grid__colmenu').attr('hidden')).toBe('hidden');
        expect($root.find('.aaxis-grid__overlay-text').text()).toBe('aaxis.common.grid.loading');
        grid.dispose();
    });

    it('renders one header per column with its label', () => {
        mountGrid({columns});

        expect($('thead th[data-col-key]').map((_i, el) => $(el).find('.aaxis-grid__th-label').text()).get())
            .toEqual(['Name', 'Qty', 'Active']);
    });

    it('marks columns sortable and filterable by default', () => {
        mountGrid({columns: [{key: 'name', label: 'Name'}]});

        const $th = $('thead th[data-col-key="name"]');
        expect($th.attr('data-sort-key')).toBe('name');
        expect($th.hasClass('aaxis-grid__th--sortable')).toBe(true);
        expect($th.find('[data-role="sort-ind"]')).toHaveLength(1);
        expect($th.find('[data-role="filter-btn"]').attr('data-col')).toBe('name');
    });

    it('omits the sort and filter controls of columns that opt out', () => {
        mountGrid({columns: [{key: 'name', label: 'Name', sortable: false, filterable: false}]});

        const $th = $('thead th[data-col-key="name"]');
        expect($th.attr('data-sort-key')).toBeUndefined();
        expect($th.hasClass('aaxis-grid__th--sortable')).toBe(false);
        expect($th.find('[data-role="sort-ind"]')).toHaveLength(0);
        expect($th.find('[data-role="filter-btn"]')).toHaveLength(0);
    });

    it('applies a fixed header width and centres number and boolean columns', () => {
        mountGrid({columns: [{key: 'name', label: 'Name', width: '120px'}, ...columns.slice(1)]});

        expect($('thead th[data-col-key="name"]').css('width')).toBe('120px');
        expect($('thead th[data-col-key="name"]').hasClass('aaxis-grid__col--center')).toBe(false);
        expect($('thead th[data-col-key="qty"]').hasClass('aaxis-grid__col--center')).toBe(true);
        expect($('thead th[data-col-key="active"]').hasClass('aaxis-grid__col--center')).toBe(true);
    });

    it('leaves columns that start hidden out of the DOM entirely', () => {
        mountGrid({columns: [...columns, {key: 'secret', label: 'Secret', hidden: true}]}, [
            {id: 1, name: 'A', qty: 1, active: true, secret: 'x'}
        ]);

        expect($('th[data-col-key="secret"], td[data-col-key="secret"]')).toHaveLength(0);
        expect($('thead th[data-col-key]')).toHaveLength(3);
    });

    it('renders the rows in the order given, up to the page size', () => {
        mountGrid({columns, pageSize: 1}, rows);

        expect(columnTexts('name')).toEqual(['Alpha']);
    });

    it('keeps the body blank behind a loading overlay until the first setRows call', () => {
        const {grid, $root} = mountGrid({columns});

        expect($root.hasClass('aaxis-grid--loading')).toBe(true);
        expect($root.find('.aaxis-grid__overlay').attr('hidden')).toBeUndefined();
        expect($root.find('tbody tr')).toHaveLength(0);
        expect($root.find('.aaxis-grid__pager').attr('hidden')).toBe('hidden');

        grid.setRows(rows);

        expect($root.hasClass('aaxis-grid--loading')).toBe(false);
        expect($root.find('.aaxis-grid__overlay').attr('hidden')).toBe('hidden');
        expect($root.find('tbody tr')).toHaveLength(2);
    });

    it('does not render rows passed as an option until setRows delivers data', () => {
        const {$root} = mountGrid({columns, rows});

        expect($root.hasClass('aaxis-grid--loading')).toBe(true);
        expect($root.find('tbody tr')).toHaveLength(0);
    });

    it('shows an empty row spanning every visible column plus the actions column', () => {
        mountGrid({columns, actions: [{key: 'edit', label: 'Edit', icon: 'fa-pencil'}]}, []);

        const $td = $('tbody td.aaxis-grid__empty');
        expect($td).toHaveLength(1);
        expect($td.attr('colspan')).toBe('4');
        expect($td.text()).toBe('aaxis.common.grid.empty');
        expect($('.aaxis-grid__pager').attr('hidden')).toBe('hidden');
    });

    it('uses the custom empty text and treats null rows as none', () => {
        const {grid} = mountGrid({columns, emptyText: 'Nothing here'}, rows);

        grid.setRows(null as any);

        expect($('td.aaxis-grid__empty').text()).toBe('Nothing here');
        expect($('td.aaxis-grid__empty').attr('colspan')).toBe('3');
    });

    it('accepts rows before it is mounted', () => {
        const grid = new DataGrid({columns});
        grid.setRows(rows);

        const $container = $('<div/>').appendTo(document.body);
        grid.mount($container);

        expect(columnTexts('name')).toEqual(['Alpha', 'Beta']);
        grid.dispose();
    });
});

describe('DataGrid cells', () => {
    it('shows each value as text with the full value as a tooltip', () => {
        mountGrid({columns}, rows);

        const $cell = $('tbody td[data-col-key="name"]').first();
        expect($cell.text()).toBe('Alpha');
        expect($cell.attr('title')).toBe('Alpha');
        expect($('tbody td[data-col-key="qty"]').first().text()).toBe('3');
        expect($('tbody td[data-col-key="qty"]').first().hasClass('aaxis-grid__col--center')).toBe(true);
    });

    it('renders missing values as empty, tooltip-less and not copyable', () => {
        mountGrid({columns}, [{id: 1, name: null}]);

        const $cell = $('tbody td[data-col-key="name"]');
        expect($cell.text()).toBe('');
        expect($cell.attr('title')).toBeUndefined();
        expect($cell.hasClass('aaxis-grid__cell--copyable')).toBe(false);
    });

    it('renders booleans as an on/off pill that is not copyable', () => {
        mountGrid({columns}, rows);

        const $pills = $('tbody td[data-col-key="active"] .aaxis-grid__badge');
        expect($pills.eq(0).hasClass('aaxis-grid__badge--on')).toBe(true);
        expect($pills.eq(0).text()).toBe('aaxis.common.grid.yes');
        expect($pills.eq(1).hasClass('aaxis-grid__badge--off')).toBe(true);
        expect($pills.eq(1).text()).toBe('aaxis.common.grid.no');
        expect($('tbody td[data-col-key="active"]').first().hasClass('aaxis-grid__cell--copyable')).toBe(false);
    });

    it('makes text cells copyable with their text as the copy value', () => {
        mountGrid({columns}, rows);

        const $cell = $('tbody td[data-col-key="name"]').first();
        expect($cell.hasClass('aaxis-grid__cell--copyable')).toBe(true);
        expect($cell.attr('data-copy')).toBe('Alpha');
    });

    it('uses a string returned by a custom renderer as text, tooltip and copy value', () => {
        mountGrid({columns: [{key: 'name', label: 'Name', render: row => row.name.toUpperCase()}]}, rows);

        const $cell = $('tbody td[data-col-key="name"]').first();
        expect($cell.text()).toBe('ALPHA');
        expect($cell.attr('title')).toBe('ALPHA');
        expect($cell.attr('data-copy')).toBe('ALPHA');
    });

    it('does not add a tooltip or copy hook for an empty string from a custom renderer', () => {
        mountGrid({columns: [{key: 'name', label: 'Name', render: () => ''}]}, rows);

        const $cell = $('tbody td[data-col-key="name"]').first();
        expect($cell.attr('title')).toBeUndefined();
        expect($cell.hasClass('aaxis-grid__cell--copyable')).toBe(false);
    });

    it('appends a node returned by a custom renderer and copies only its copyValue', () => {
        mountGrid({
            columns: [{
                key: 'name',
                label: 'Name',
                render: row => $('<em class="preview"/>').text('view ' + row.name),
                copyValue: row => 'copy-' + row.name
            }]
        }, rows);

        const $cell = $('tbody td[data-col-key="name"]').first();
        expect($cell.find('em.preview').text()).toBe('view Alpha');
        expect($cell.attr('data-copy')).toBe('copy-Alpha');
    });

    it('leaves node cells without a copyValue uncopyable', () => {
        mountGrid({columns: [{key: 'name', label: 'Name', render: () => $('<b/>').text('x')}]}, rows);

        expect($('tbody td[data-col-key="name"]').first().hasClass('aaxis-grid__cell--copyable')).toBe(false);
    });

    it('treats a null copyValue as nothing to copy', () => {
        mountGrid({
            columns: [{key: 'name', label: 'Name', render: () => $('<b/>'), copyValue: () => null as any}]
        }, rows);

        expect($('tbody td[data-col-key="name"]').first().hasClass('aaxis-grid__cell--copyable')).toBe(false);
    });
});

describe('DataGrid actions', () => {
    const actions = [
        {key: 'edit', label: 'Edit', icon: 'fa-pencil'},
        {key: 'delete', label: 'Delete', icon: 'fa-trash', variant: 'danger' as const},
        {key: 'dwl', label: 'Open DWL', badge: 'dwl'}
    ];

    it('renders an actions header and one button per action and row', () => {
        mountGrid({columns, actions}, rows);

        expect($('thead th.aaxis-grid__col-actions').text()).toBe('aaxis.common.grid.actions');
        const $row = $('tbody tr').first();
        expect($row.find('td.aaxis-grid__col-actions button[data-action]').map((_i, el) => $(el).attr('data-action')).get())
            .toEqual(['edit', 'delete', 'dwl']);
    });

    it('renders no actions column without actions', () => {
        mountGrid({columns}, rows);

        expect($('.aaxis-grid__col-actions')).toHaveLength(0);
    });

    it('describes each button with its label, row id, and icon or badge', () => {
        mountGrid({columns, actions}, rows);

        const $edit = $('tbody tr').eq(1).find('[data-action="edit"]');
        expect($edit.attr('data-id')).toBe('2');
        expect($edit.attr('title')).toBe('Edit');
        expect($edit.attr('aria-label')).toBe('Edit');
        expect($edit.find('.fa').hasClass('fa-pencil')).toBe(true);
        expect($edit.hasClass('aaxis-grid__action--danger')).toBe(false);

        expect($('[data-action="delete"]').first().hasClass('aaxis-grid__action--danger')).toBe(true);

        const $dwl = $('[data-action="dwl"]').first();
        expect($dwl.hasClass('aaxis-grid__action--badge')).toBe(true);
        expect($dwl.find('.aaxis-grid__action-badge').text()).toBe('dwl');
        expect($dwl.find('.fa')).toHaveLength(0);
    });

    it('takes the row id from a custom idKey', () => {
        mountGrid({columns, actions, idKey: 'uuid'}, [{uuid: 'abc', name: 'A'}]);

        expect($('[data-action="edit"]').attr('data-id')).toBe('abc');
    });

    it('renders an action without an icon as a bare glyph span', () => {
        mountGrid({columns, actions: [{key: 'x', label: 'X'}]}, rows);

        expect($('[data-action="x"]').first().find('span.fa')).toHaveLength(1);
    });

    it('disables the button of a row whose predicate matches, explaining why in the tooltip', () => {
        mountGrid({
            columns,
            actions: [{
                key: 'delete', label: 'Delete', icon: 'fa-trash',
                disabled: row => row.id === 1, disabledTitle: 'In use'
            }]
        }, rows);

        const $first = $('tbody tr').eq(0).find('[data-action="delete"]');
        expect($first.prop('disabled')).toBe(true);
        expect($first.attr('aria-disabled')).toBe('true');
        expect($first.hasClass('aaxis-grid__action--disabled')).toBe(true);
        expect($first.attr('title')).toBe('In use');

        const $second = $('tbody tr').eq(1).find('[data-action="delete"]');
        expect($second.prop('disabled')).toBe(false);
        expect($second.attr('title')).toBe('Delete');
    });

    it('falls back to the label as tooltip when a disabled action has no disabledTitle', () => {
        mountGrid({columns, actions: [{key: 'delete', label: 'Delete', disabled: () => true}]}, rows);

        expect($('[data-action="delete"]').first().attr('title')).toBe('Delete');
    });

    it.each([
        ['icon-only actions keep the historical 110px floor', [{key: 'a', label: 'A', icon: 'fa-x'}], '110px'],
        ['four icons need 24px padding + 4 x 28px', Array.from({length: 4}, (_v, i) => ({key: 'a' + i, label: 'A', icon: 'fa-x'})), '136px'],
        ['a badge costs its length x 8px + 26px', [
            {key: 'a', label: 'A', badge: 'download'},
            {key: 'b', label: 'B', icon: 'fa-x'},
            {key: 'c', label: 'C', icon: 'fa-x'}
        ], '170px']
    ])('sizes the actions header from the action set: %s', (_name, gridActions, expected) => {
        mountGrid({columns, actions: gridActions}, rows);

        expect($('thead th.aaxis-grid__col-actions').get(0)!.style.width).toBe(expected);
    });

    it('hands the action key, the row and the raw click event to onAction', () => {
        const onAction = vi.fn();
        mountGrid({columns, actions, onAction}, rows);

        const button = $('tbody tr').eq(1).find('[data-action="edit"]').get(0)!;
        button.dispatchEvent(new MouseEvent('click', {bubbles: true, ctrlKey: true}));

        expect(onAction).toHaveBeenCalledTimes(1);
        const [key, row, event] = onAction.mock.calls[0];
        expect(key).toBe('edit');
        expect(row).toBe(rows[1]);
        expect(event).toBeInstanceOf(MouseEvent);
        expect(event.ctrlKey).toBe(true);
    });

    it('matches numeric ids against the stringified data-id attribute', () => {
        const onAction = vi.fn();
        mountGrid({columns, actions, onAction}, [{id: 7, name: 'Seven'}]);

        $('[data-action="edit"]').trigger('click');

        expect(onAction.mock.calls[0][1]).toEqual({id: 7, name: 'Seven'});
    });

    it('does nothing when no onAction handler is given', () => {
        mountGrid({columns, actions}, rows);

        expect(() => $('[data-action="edit"]').first().trigger('click')).not.toThrow();
    });

    it('does not call onAction for an id that is no longer among the rows', () => {
        const onAction = vi.fn();
        const {grid} = mountGrid({columns, actions, onAction}, rows);
        const $stale = $('[data-action="edit"]').first();

        grid.setRows([{id: 99, name: 'Other'}]);
        $stale.trigger('click');

        expect(onAction).not.toHaveBeenCalled();
    });
});

describe('DataGrid clickable rows', () => {
    it('marks rows clickable and reports the clicked row with its event', () => {
        const onRowClick = vi.fn();
        mountGrid({columns, onRowClick}, rows);

        const $tr = $('tbody tr').eq(1);
        expect($tr.hasClass('aaxis-grid__row--clickable')).toBe(true);
        $tr.find('td[data-col-key="name"]').get(0)!.dispatchEvent(new MouseEvent('click', {bubbles: true, metaKey: true}));

        expect(onRowClick).toHaveBeenCalledTimes(1);
        expect(onRowClick.mock.calls[0][0]).toBe(rows[1]);
        expect(onRowClick.mock.calls[0][1].metaKey).toBe(true);
    });

    it('does not mark rows clickable without onRowClick', () => {
        mountGrid({columns}, rows);

        expect($('tbody tr').first().hasClass('aaxis-grid__row--clickable')).toBe(false);
    });

    it('turns click-to-copy off, since both gestures share one click', () => {
        mountGrid({columns, onRowClick: vi.fn()}, rows);

        expect($('.aaxis-grid__cell--copyable')).toHaveLength(0);
        expect($('td[data-copy]')).toHaveLength(0);
    });

    it.each([
        ['a link', '<a href="#">go</a>'],
        ['a button', '<button type="button">go</button>'],
        ['an input', '<input type="text"/>'],
        ['a select', '<select><option>x</option></select>'],
        ['a label', '<label>go</label>']
    ])('leaves clicks on %s inside a cell to that element', (_name, html) => {
        const onRowClick = vi.fn();
        mountGrid({
            columns: [{key: 'name', label: 'Name', render: () => $(html)}],
            onRowClick
        }, rows);

        $('tbody tr').first().find('td').children().first().trigger('click');

        expect(onRowClick).not.toHaveBeenCalled();
    });

    it('leaves clicks on the actions cell and its buttons to the actions', () => {
        const onRowClick = vi.fn();
        const onAction = vi.fn();
        mountGrid({columns, actions: [{key: 'edit', label: 'Edit', icon: 'fa-pencil'}], onRowClick, onAction}, rows);

        $('tbody tr').first().find('td.aaxis-grid__col-actions').trigger('click');
        $('tbody tr').first().find('[data-action="edit"]').trigger('click');

        expect(onRowClick).not.toHaveBeenCalled();
        expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('falls back to the jQuery event when the click has no native event behind it', () => {
        const onRowClick = vi.fn();
        mountGrid({columns, onRowClick}, rows);

        $('tbody tr').first().find('td').first().trigger('click');

        expect(onRowClick).toHaveBeenCalledTimes(1);
        expect(onRowClick.mock.calls[0][1].type).toBe('click');
    });
});

describe('DataGrid click-to-copy', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
            cb(0);
            return 1;
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        delete (document as any).execCommand;
    });

    it('copies the cell value through the async clipboard API and confirms with a toast', async () => {
        const writeText = vi.fn(() => Promise.resolve());
        vi.stubGlobal('navigator', {clipboard: {writeText}});
        mountGrid({columns}, rows);

        $('tbody td[data-col-key="name"]').first().trigger('click');
        await flush();

        expect(writeText).toHaveBeenCalledWith('Alpha');
        const $toast = $('body > .aaxis-grid__toast');
        expect($toast.text()).toBe('aaxis.common.grid.copied');
        expect($toast.hasClass('is-visible')).toBe(true);
    });

    it('fades the toast out and removes it after a moment', async () => {
        vi.stubGlobal('navigator', {clipboard: {writeText: vi.fn(() => Promise.resolve())}});
        mountGrid({columns}, rows);
        $('tbody td[data-col-key="name"]').first().trigger('click');
        await flush();

        vi.advanceTimersByTime(1800);
        expect($('.aaxis-grid__toast').hasClass('is-visible')).toBe(false);
        expect($('.aaxis-grid__toast')).toHaveLength(1);

        vi.advanceTimersByTime(300);
        expect($('.aaxis-grid__toast')).toHaveLength(0);
    });

    it('stays silent when the clipboard write is rejected', async () => {
        vi.stubGlobal('navigator', {clipboard: {writeText: vi.fn(() => Promise.reject(new Error('denied')))}});
        mountGrid({columns}, rows);

        $('tbody td[data-col-key="name"]').first().trigger('click');
        await flush();

        expect($('.aaxis-grid__toast')).toHaveLength(0);
    });

    it('falls back to execCommand where the Clipboard API is unavailable', () => {
        const execCommand = vi.fn(() => true);
        (document as any).execCommand = execCommand;
        let copied = '';
        execCommand.mockImplementation(() => {
            copied = (document.querySelector('textarea') as HTMLTextAreaElement).value;
            return true;
        });
        mountGrid({columns}, rows);

        $('tbody td[data-col-key="name"]').first().trigger('click');

        expect(execCommand).toHaveBeenCalledWith('copy');
        expect(copied).toBe('Alpha');
        expect(document.querySelector('textarea')).toBeNull();
        expect($('.aaxis-grid__toast').text()).toBe('aaxis.common.grid.copied');
    });

    it('shows no toast when execCommand reports failure, and still removes its scratch textarea', () => {
        (document as any).execCommand = vi.fn(() => false);
        mountGrid({columns}, rows);

        $('tbody td[data-col-key="name"]').first().trigger('click');

        expect($('.aaxis-grid__toast')).toHaveLength(0);
        expect(document.querySelector('textarea')).toBeNull();
    });

    it('removes the scratch textarea even when execCommand throws', () => {
        (document as any).execCommand = vi.fn(() => {
            throw new Error('boom');
        });
        mountGrid({columns}, rows);

        expect(() => $('tbody td[data-col-key="name"]').first().trigger('click')).toThrow('boom');
        expect(document.querySelector('textarea')).toBeNull();
    });

    it('copies the cell text when the copy attribute has been stripped', () => {
        const execCommand = vi.fn(() => true);
        (document as any).execCommand = execCommand;
        mountGrid({columns}, rows);
        const $cell = $('tbody td[data-col-key="name"]').first().removeAttr('data-copy');

        $cell.trigger('click');

        expect(execCommand).toHaveBeenCalledWith('copy');
    });

    it('copies nothing for an empty value', () => {
        const execCommand = vi.fn(() => true);
        (document as any).execCommand = execCommand;
        mountGrid({columns}, rows);

        $('tbody td[data-col-key="name"]').first().attr('data-copy', '').trigger('click');

        expect(execCommand).not.toHaveBeenCalled();
        expect($('.aaxis-grid__toast')).toHaveLength(0);
    });
});

describe('DataGrid dispose', () => {
    it('removes the grid from the page', () => {
        const {grid, $container} = mountGrid({columns}, rows);

        grid.dispose();

        expect($container.find('.aaxis-grid')).toHaveLength(0);
    });

    it('detaches its document and window listeners', () => {
        const {grid} = mountGrid({columns}, rows);
        const before = ($ as any)._data(document, 'events');
        expect(before.click.some((h: any) => h.namespace === 'aaxisGrid')).toBe(true);
        expect(before.keydown.some((h: any) => h.namespace === 'aaxisGrid')).toBe(true);

        grid.dispose();

        const after = ($ as any)._data(document, 'events') ?? {};
        expect((after.click ?? []).some((h: any) => h.namespace === 'aaxisGrid')).toBe(false);
        expect((after.keydown ?? []).some((h: any) => h.namespace === 'aaxisGrid')).toBe(false);
        const winEvents = ($ as any)._data(window, 'events') ?? {};
        expect((winEvents.resize ?? []).some((h: any) => h.namespace === 'aaxisGrid')).toBe(false);
    });

    it('can be called twice, or before the grid was ever mounted', () => {
        const {grid} = mountGrid({columns}, rows);
        grid.dispose();

        expect(() => grid.dispose()).not.toThrow();
        expect(() => new DataGrid({columns}).dispose()).not.toThrow();
    });
});
