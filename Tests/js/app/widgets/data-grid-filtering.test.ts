import $ from 'jquery';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import type {GridColumn} from '../../../../Resources/js-src/app/widgets/data-grid';
import {applyFilter, columnTexts, mountGrid, openFilter} from './support/data-grid';

const columns: GridColumn[] = [
    {key: 'name', label: 'Name'},
    {key: 'qty', label: 'Qty', type: 'number'},
    {key: 'active', label: 'Active', type: 'boolean'},
    {key: 'created', label: 'Created', type: 'datetime'},
    {key: 'payload', label: 'Payload', type: 'json'}
];

function ops(): string[] {
    return $('.aaxis-grid__popover [data-role="op"] option').map((_i, el) => $(el).attr('value') as string).get();
}

describe('DataGrid filter popover', () => {
    it('opens under the funnel button with the text operators and a text value box', () => {
        mountGrid({columns}, []);

        openFilter('name');

        const $pop = $('.aaxis-grid__popover');
        expect($pop.attr('hidden')).toBeUndefined();
        expect(ops()).toEqual(['contains', 'not_contains', 'starts_with', 'ends_with', 'equals', 'not_empty']);
        expect($pop.find('[data-role="op"]').val()).toBe('contains');
        expect($pop.find('[data-role="value"]').attr('type')).toBe('text');
        expect($pop.find('[data-role="filter-apply"]').text()).toBe('aaxis.common.grid.filter_apply');
        expect($pop.find('[data-role="filter-clear"]').text()).toBe('aaxis.common.grid.filter_clear');
        expect($pop.find('[data-role="op"] option').first().text()).toBe('aaxis.common.grid.op.contains');
    });

    it.each([
        ['number', 'qty', ['equals', 'gt', 'lt', 'not_empty'], 'number'],
        ['datetime', 'created', ['equals', 'after', 'before', 'not_empty'], 'datetime-local'],
        ['boolean', 'active', ['equals', 'not_empty'], null],
        ['json', 'payload', ['contains', 'not_contains', 'starts_with', 'ends_with', 'equals', 'not_empty'], 'text']
    ])('offers the %s operators and matching value control', (_type, key, expectedOps, inputType) => {
        mountGrid({columns}, []);

        openFilter(key);

        expect(ops()).toEqual(expectedOps);
        const $value = $('.aaxis-grid__popover [data-role="value"]');
        if (inputType === null) {
            expect($value.is('select')).toBe(true);
            expect($value.find('option').map((_i, el) => $(el).attr('value')).get()).toEqual(['yes', 'no']);
        } else {
            expect($value.attr('type')).toBe(inputType);
        }
    });

    it('adds a dotted-path box for JSON columns only', () => {
        mountGrid({columns}, []);

        openFilter('payload');
        expect($('.aaxis-grid__popover [data-role="json-path"]')).toHaveLength(1);

        openFilter('name');
        expect($('.aaxis-grid__popover [data-role="json-path"]')).toHaveLength(0);
    });

    it('offers a date/datetime mode selector for datetime columns, defaulting to datetime', () => {
        mountGrid({columns}, []);

        openFilter('created');

        expect($('.aaxis-grid__popover [data-role="date-mode"]').val()).toBe('datetime');
    });

    it('switches the input to a date box and clears it when the mode changes', () => {
        mountGrid({columns}, []);
        openFilter('created');
        const $value = $('.aaxis-grid__popover [data-role="value"]');
        $value.val('2024-05-10T10:30');

        $('.aaxis-grid__popover [data-role="date-mode"]').val('date').trigger('change');

        expect($value.attr('type')).toBe('date');
        expect($value.val()).toBe('');

        $('.aaxis-grid__popover [data-role="date-mode"]').val('datetime').trigger('change');
        expect($value.attr('type')).toBe('datetime-local');
    });

    it('drops the value control for "not empty" and brings it back for other operators', () => {
        mountGrid({columns}, []);
        openFilter('name');

        $('.aaxis-grid__popover [data-role="op"]').val('not_empty').trigger('change');
        expect($('.aaxis-grid__popover [data-role="value"]')).toHaveLength(0);

        $('.aaxis-grid__popover [data-role="op"]').val('equals').trigger('change');
        expect($('.aaxis-grid__popover [data-role="value"]')).toHaveLength(1);
    });

    it('closes when the same funnel is clicked again', () => {
        mountGrid({columns}, []);
        openFilter('name');

        openFilter('name');

        expect($('.aaxis-grid__popover').attr('hidden')).toBe('hidden');
        expect($('.aaxis-grid__popover').children()).toHaveLength(0);
    });

    it('switches to the other column when a different funnel is clicked', () => {
        mountGrid({columns}, []);
        openFilter('name');

        openFilter('qty');

        expect($('.aaxis-grid__popover').attr('hidden')).toBeUndefined();
        expect(ops()).toEqual(['equals', 'gt', 'lt', 'not_empty']);
    });

    it('ignores a funnel that belongs to no known column', () => {
        const {$root} = mountGrid({columns}, []);
        $root.append('<button data-role="filter-btn" data-col="ghost"></button>');

        $root.find('[data-col="ghost"]').trigger('click');

        expect($('.aaxis-grid__popover').attr('hidden')).toBe('hidden');
    });

    describe('placement', () => {
        function place(buttonLeft: number): void {
            const root = $('.aaxis-grid').get(0)!;
            Object.defineProperty(root, 'clientWidth', {value: 800, configurable: true});
            root.getBoundingClientRect = () => ({left: 20, top: 10} as DOMRect);
            const button = $('[data-role="filter-btn"][data-col="name"]').get(0)!;
            button.getBoundingClientRect = () => ({left: buttonLeft, bottom: 60} as DOMRect);
        }

        it('sits just below the funnel, aligned to it', () => {
            mountGrid({columns}, []);
            place(100);

            openFilter('name');

            expect($('.aaxis-grid__popover').css('top')).toBe('54px');
            expect($('.aaxis-grid__popover').css('left')).toBe('72px');
        });

        it('is pulled back inside the grid when the funnel is near the right edge', () => {
            mountGrid({columns}, []);
            place(700);

            openFilter('name');

            expect($('.aaxis-grid__popover').css('left')).toBe('556px');
        });

        it('never starts left of the grid', () => {
            mountGrid({columns}, []);
            place(0);

            openFilter('name');

            expect($('.aaxis-grid__popover').css('left')).toBe('0px');
        });
    });

    describe('applying', () => {
        const rows = [
            {id: 1, name: 'Alpha'},
            {id: 2, name: 'Beta'},
            {id: 3, name: 'Alphabet'}
        ];

        it('filters the rows, closes the popover and lights up the funnel', () => {
            mountGrid({columns}, rows);
            openFilter('name');

            applyFilter({value: 'alpha'});

            expect(columnTexts('name')).toEqual(['Alpha', 'Alphabet']);
            expect($('.aaxis-grid__popover').attr('hidden')).toBe('hidden');
            expect($('[data-role="filter-btn"][data-col="name"]').hasClass('aaxis-grid__filter-btn--active')).toBe(true);
            expect($('[data-role="filter-btn"][data-col="qty"]').hasClass('aaxis-grid__filter-btn--active')).toBe(false);
        });

        it('applies on Enter inside a value box and ignores other keys', () => {
            mountGrid({columns}, rows);
            openFilter('name');
            const $input = $('.aaxis-grid__popover [data-role="value"]').val('beta');

            $input.trigger($.Event('keydown', {key: 'a'}));
            expect(columnTexts('name')).toHaveLength(3);

            $input.trigger($.Event('keydown', {key: 'Enter'}));
            expect(columnTexts('name')).toEqual(['Beta']);
        });

        it('clears the column filter with the Clear button', () => {
            mountGrid({columns}, rows);
            openFilter('name');
            applyFilter({value: 'beta'});
            openFilter('name');

            $('.aaxis-grid__popover [data-role="filter-clear"]').trigger('click');

            expect(columnTexts('name')).toHaveLength(3);
            expect($('[data-role="filter-btn"][data-col="name"]').hasClass('aaxis-grid__filter-btn--active')).toBe(false);
            expect($('.aaxis-grid__popover').attr('hidden')).toBe('hidden');
        });

        it('treats an empty value as clearing the filter', () => {
            mountGrid({columns}, rows);
            openFilter('name');
            applyFilter({value: 'beta'});
            openFilter('name');

            applyFilter({value: '   '});

            expect(columnTexts('name')).toHaveLength(3);
            expect($('[data-role="filter-btn"][data-col="name"]').hasClass('aaxis-grid__filter-btn--active')).toBe(false);
        });

        it('keeps a "not empty" filter even though it has no value', () => {
            mountGrid({columns}, [...rows, {id: 4, name: ''}]);
            openFilter('name');

            applyFilter({op: 'not_empty'});

            expect(columnTexts('name')).toEqual(['Alpha', 'Beta', 'Alphabet']);
            expect($('[data-role="filter-btn"][data-col="name"]').hasClass('aaxis-grid__filter-btn--active')).toBe(true);
        });

        it('reopens showing the filter that is in force', () => {
            mountGrid({columns}, rows);
            openFilter('name');
            applyFilter({op: 'starts_with', value: 'alph'});

            openFilter('name');

            expect($('.aaxis-grid__popover [data-role="op"]').val()).toBe('starts_with');
            expect($('.aaxis-grid__popover [data-role="value"]').val()).toBe('alph');
        });

        it('goes back to the first page', () => {
            const many = Array.from({length: 30}, (_v, i) => ({id: i, name: 'row' + i}));
            mountGrid({columns, pageSize: 10}, many);
            $('[data-role="next"]').trigger('click');
            expect($('[data-role="page-number"]').text()).toBe('2');
            openFilter('name');

            applyFilter({value: 'row'});

            expect($('[data-role="page-number"]').text()).toBe('1');
        });

        it('reopens a datetime filter in the mode it was applied with', () => {
            mountGrid({columns}, []);
            openFilter('created');
            applyFilter({mode: 'date', value: '2024-05-10', op: 'equals'});

            openFilter('created');

            expect($('.aaxis-grid__popover [data-role="date-mode"]').val()).toBe('date');
            expect($('.aaxis-grid__popover [data-role="value"]').attr('type')).toBe('date');
            expect($('.aaxis-grid__popover [data-role="value"]').val()).toBe('2024-05-10');
        });

        it('reopens a number filter with its value, and a boolean filter with its choice', () => {
            mountGrid({columns}, []);
            openFilter('qty');
            applyFilter({op: 'gt', value: '7'});
            openFilter('active');
            applyFilter({op: 'equals', value: 'no'});

            openFilter('qty');
            expect($('.aaxis-grid__popover [data-role="value"]').val()).toBe('7');
            openFilter('active');
            expect($('.aaxis-grid__popover [data-role="value"]').val()).toBe('no');
        });

        it('filters a JSON column by a path alone', () => {
            mountGrid({columns}, [
                {id: 1, payload: '{"a":{"b":"x"}}'},
                {id: 2, payload: '{"a":{}}'}
            ]);
            openFilter('payload');

            applyFilter({path: '  a.b ', op: 'not_empty'});
            expect(columnTexts('payload')).toEqual(['{"a":{"b":"x"}}']);

            openFilter('payload');
            expect($('.aaxis-grid__popover [data-role="json-path"]').val()).toBe('a.b');
        });

        it('keeps a path-only JSON filter with an empty value box', () => {
            mountGrid({columns}, [
                {id: 1, payload: '{"a":"hello"}'},
                {id: 2, payload: '{"a":"bye"}'}
            ]);
            openFilter('payload');

            applyFilter({path: 'a', value: ''});

            // Nothing typed as value: "contains ''" matches whatever resolves at the path.
            expect($('[data-role="filter-btn"][data-col="payload"]').hasClass('aaxis-grid__filter-btn--active')).toBe(true);
            expect(columnTexts('payload')).toHaveLength(2);
        });
    });
});

describe('DataGrid dismissing popovers', () => {
    it('closes the filter popover on Escape and returns focus to its funnel', () => {
        mountGrid({columns}, []);
        openFilter('name');

        $(document).trigger($.Event('keydown', {key: 'Escape'}));

        expect($('.aaxis-grid__popover').attr('hidden')).toBe('hidden');
        expect(document.activeElement).toBe($('[data-role="filter-btn"][data-col="name"]').get(0));
    });

    it('ignores other keys', () => {
        mountGrid({columns}, []);
        openFilter('name');

        $(document).trigger($.Event('keydown', {key: 'Enter'}));

        expect($('.aaxis-grid__popover').attr('hidden')).toBeUndefined();
    });

    it('does nothing on Escape when nothing is open', () => {
        mountGrid({columns}, []);

        expect(() => $(document).trigger($.Event('keydown', {key: 'Escape'}))).not.toThrow();
        expect($('.aaxis-grid__popover').attr('hidden')).toBe('hidden');
    });

    it('closes the filter popover on a click elsewhere', () => {
        mountGrid({columns}, []);
        openFilter('name');

        $(document.body).trigger('click');

        expect($('.aaxis-grid__popover').attr('hidden')).toBe('hidden');
    });

    it('keeps the popover open for clicks inside it', () => {
        mountGrid({columns}, []);
        openFilter('name');

        $('.aaxis-grid__popover [data-role="value"]').get(0)!.dispatchEvent(new MouseEvent('click', {bubbles: true}));

        expect($('.aaxis-grid__popover').attr('hidden')).toBeUndefined();
    });

    it('stops reacting to the document once disposed', () => {
        const {grid} = mountGrid({columns}, []);
        openFilter('name');
        const popover = $('.aaxis-grid__popover');

        grid.dispose();
        $(document).trigger($.Event('keydown', {key: 'Escape'}));

        expect(popover.attr('hidden')).toBeUndefined();
    });
});

describe('DataGrid.setFilter', () => {
    const rows = [
        {id: 1, name: 'Alpha', qty: 1},
        {id: 2, name: 'Beta', qty: 2}
    ];

    it('filters programmatically and lights up the funnel so the user can clear it', () => {
        const {grid} = mountGrid({columns}, rows);

        grid.setFilter('name', {operator: 'equals', value: 'beta'});

        expect(columnTexts('name')).toEqual(['Beta']);
        expect($('[data-role="filter-btn"][data-col="name"]').hasClass('aaxis-grid__filter-btn--active')).toBe(true);

        openFilter('name');
        expect($('.aaxis-grid__popover [data-role="op"]').val()).toBe('equals');
        expect($('.aaxis-grid__popover [data-role="value"]').val()).toBe('beta');
    });

    it('clears a filter with null', () => {
        const {grid} = mountGrid({columns}, rows);
        grid.setFilter('name', {operator: 'equals', value: 'beta'});

        grid.setFilter('name', null);

        expect(columnTexts('name')).toEqual(['Alpha', 'Beta']);
        expect($('[data-role="filter-btn"][data-col="name"]').hasClass('aaxis-grid__filter-btn--active')).toBe(false);
    });

    it('returns to page one like the popover does', () => {
        const many = Array.from({length: 30}, (_v, i) => ({id: i, name: 'row' + i}));
        const {grid} = mountGrid({columns, pageSize: 10}, many);
        $('[data-role="next"]').trigger('click');

        grid.setFilter('name', {operator: 'contains', value: 'row'});

        expect($('[data-role="page-number"]').text()).toBe('1');
    });

    it('dismisses an open popover so its stale Apply cannot overwrite the new filter', () => {
        const {grid} = mountGrid({columns}, rows);
        openFilter('name');

        grid.setFilter('qty', {operator: 'gt', value: 1});

        expect($('.aaxis-grid__popover').attr('hidden')).toBe('hidden');
        expect(columnTexts('name')).toEqual(['Beta']);
    });

    it('also closes an open column menu', () => {
        const {grid} = mountGrid({columns}, rows);
        grid.toggleColumnSettings($('<button/>').appendTo(document.body).get(0));
        expect($('.aaxis-grid__colmenu').attr('hidden')).toBeUndefined();

        grid.setFilter('name', {operator: 'contains', value: 'a'});

        expect($('.aaxis-grid__colmenu').attr('hidden')).toBe('hidden');
    });

    it('has no effect for a column the grid does not have', () => {
        const {grid} = mountGrid({columns}, rows);

        grid.setFilter('ghost', {operator: 'equals', value: 'x'});

        expect(columnTexts('name')).toEqual(['Alpha', 'Beta']);
    });
});

describe('DataGrid filter matching', () => {
    function names(): string[] {
        return columnTexts('name');
    }

    describe('text columns', () => {
        const rows = [
            {id: 1, name: 'Alpha'},
            {id: 2, name: 'alphabet'},
            {id: 3, name: 'Beta'},
            {id: 4, name: null}
        ];

        it.each([
            ['contains', 'ALP', ['Alpha', 'alphabet']],
            ['not_contains', 'alp', ['Beta', '']],
            ['starts_with', 'alpha', ['Alpha', 'alphabet']],
            ['ends_with', 'ta', ['Beta']],
            ['equals', 'ALPHA', ['Alpha']],
            ['not_empty', '', ['Alpha', 'alphabet', 'Beta']],
            ['unknown_operator', 'zzz', ['Alpha', 'alphabet', 'Beta', '']]
        ])('%s "%s"', (operator, value, expected) => {
            const {grid} = mountGrid({columns}, rows);

            grid.setFilter('name', {operator, value});

            expect(names()).toEqual(expected);
        });

        it('treats whitespace-only cells as empty for "not empty"', () => {
            const {grid} = mountGrid({columns}, [{id: 1, name: '   '}, {id: 2, name: 'x'}]);

            grid.setFilter('name', {operator: 'not_empty', value: ''});

            expect(names()).toEqual(['x']);
        });

        it('combines filters of several columns', () => {
            const {grid} = mountGrid({columns}, [
                {id: 1, name: 'Alpha', qty: 1},
                {id: 2, name: 'Alpha', qty: 9},
                {id: 3, name: 'Beta', qty: 9}
            ]);

            grid.setFilter('name', {operator: 'equals', value: 'alpha'});
            grid.setFilter('qty', {operator: 'gt', value: 5});

            expect(columnTexts('qty')).toEqual(['9']);
        });
    });

    describe('number columns', () => {
        const rows = [
            {id: 1, name: 'a', qty: 3},
            {id: 2, name: 'b', qty: 10},
            {id: 3, name: 'c', qty: 7}
        ];

        it.each([
            ['gt', '5', ['b', 'c']],
            ['lt', '5', ['a']],
            ['equals', '7', ['c']],
            ['equals', 7, ['c']],
            ['not_empty', '', ['a', 'b', 'c']],
            ['unknown_operator', '5', ['a', 'b', 'c']],
            ['gt', 'abc', ['a', 'b', 'c']]
        ])('%s %s', (operator, value, expected) => {
            const {grid} = mountGrid({columns}, rows);

            grid.setFilter('qty', {operator, value});

            expect(names()).toEqual(expected);
        });
    });

    describe('boolean columns', () => {
        const rows = [
            {id: 1, name: 'on', active: true},
            {id: 2, name: 'off', active: false},
            {id: 3, name: 'missing', active: null}
        ];

        it.each([
            ['equals', 'yes', ['on']],
            ['equals', 'no', ['off', 'missing']],
            ['not_empty', '', ['on', 'off']],
            ['unknown_operator', 'yes', ['on', 'off', 'missing']]
        ])('%s %s', (operator, value, expected) => {
            const {grid} = mountGrid({columns}, rows);

            grid.setFilter('active', {operator, value});

            expect(names()).toEqual(expected);
        });

        it('filters through the popover with the yes/no choice', () => {
            mountGrid({columns}, rows);
            openFilter('active');

            applyFilter({op: 'equals', value: 'yes'});

            expect(names()).toEqual(['on']);
        });
    });

    describe('datetime columns', () => {
        const rows = [
            {id: 1, name: 'morning', created: '2024-05-10T10:30'},
            {id: 2, name: 'afternoon', created: '2024-05-10T14:00:45'},
            {id: 3, name: 'june', created: '2024-06-01T09:00'},
            {id: 4, name: 'blank', created: ''},
            {id: 5, name: 'garbage', created: 'not a date'}
        ];

        it.each([
            ['after', '2024-05-10T12:00', ['afternoon', 'june']],
            ['before', '2024-05-10T12:00', ['morning']],
            ['equals', '2024-05-10T14:00', ['afternoon']],
            ['not_empty', '', ['morning', 'afternoon', 'june', 'garbage']],
            ['unknown_operator', '2024-05-10T12:00', ['morning', 'afternoon', 'june']]
        ])('%s %s (rows that cannot be parsed never match a date comparison)', (operator, value, expected) => {
            const {grid} = mountGrid({columns}, rows);

            grid.setFilter('created', {operator, value});

            expect(names()).toEqual(expected);
        });

        it('matches nothing when the filter date itself cannot be parsed', () => {
            const {grid} = mountGrid({columns}, rows);

            grid.setFilter('created', {operator: 'after', value: 'soon'});

            expect(names()).toEqual([]);
        });

        // The date box yields 'YYYY-MM-DD' — a local calendar day. Run the same expectations in
        // zones on both sides of Greenwich (the offset guard proves the switch took effect).
        describe.each([
            ['UTC', 0],
            ['America/Sao_Paulo', 180],
            ['Asia/Tokyo', -540],
            ['Pacific/Pago_Pago', 660]
        ])('by calendar day in %s', (zone, offset) => {
            const originalTz = process.env.TZ;

            beforeEach(() => {
                process.env.TZ = zone;
                expect(new Date(2024, 4, 10).getTimezoneOffset()).toBe(offset);
            });

            afterEach(() => {
                if (originalTz === undefined) {
                    delete process.env.TZ;
                } else {
                    process.env.TZ = originalTz;
                }
            });

            const dayRows = [
                {id: 1, name: 'may9', created: '2024-05-09T23:30:00'},
                {id: 2, name: 'may10-early', created: '2024-05-10T00:30:00'},
                {id: 3, name: 'may10-late', created: '2024-05-10T23:30:00'},
                {id: 4, name: 'may11', created: '2024-05-11T00:30:00'}
            ];

            it.each([
                ['equals', ['may10-early', 'may10-late']],
                ['after', ['may11']],
                ['before', ['may9']]
            ])('%s ignores the time of day in date mode', (op, expected) => {
                mountGrid({columns}, dayRows);
                openFilter('created');

                applyFilter({op, mode: 'date', value: '2024-05-10'});

                expect(names()).toEqual(expected);
            });

            it('matches date-only cell values against the same day', () => {
                mountGrid({columns}, [
                    {id: 1, name: 'same', created: '2024-05-10'},
                    {id: 2, name: 'other', created: '2024-05-11'}
                ]);
                openFilter('created');

                applyFilter({op: 'equals', mode: 'date', value: '2024-05-10'});

                expect(names()).toEqual(['same']);
            });
        });
    });

    describe('JSON columns', () => {
        const rows = [
            {id: 1, name: 'string', payload: '{"a":{"b":"Hello"},"n":5,"gone":null}'},
            {id: 2, name: 'object', payload: {a: {b: 'bye'}, list: [1, 2]}},
            {id: 3, name: 'plain', payload: 'not json'},
            {id: 4, name: 'null', payload: null}
        ];

        it.each([
            ['no path, searches the whole JSON text', undefined, 'contains', 'hello', ['string']],
            ['no path, objects are stringified', undefined, 'contains', '"list":[1,2]', ['object']],
            ['no path, invalid JSON falls back to the raw text', undefined, 'contains', 'not json', ['plain']],
            ['a nested path', 'a.b', 'contains', 'hello', ['string']],
            ['a path to an object value stringifies it', 'a', 'contains', '"b":"bye"', ['object']],
            ['a path to a number', 'n', 'equals', '5', ['string']],
            ['a path to an array', 'list', 'equals', '[1,2]', ['object']],
            ['starts_with on a path', 'a.b', 'starts_with', 'by', ['object']],
            ['not_contains on a path counts rows missing it', 'a.b', 'not_contains', 'hello', ['object', 'plain', 'null']],
            ['not_empty on a path', 'a.b', 'not_empty', '', ['string', 'object']],
            ['not_empty on a path with a null value', 'gone', 'not_empty', '', []],
            ['a path through a scalar', 'n.x', 'contains', 'x', []],
            ['not_empty without a path', undefined, 'not_empty', '', ['string', 'object', 'plain']]
        ])('%s', (_name, jsonPath, operator, value, expected) => {
            const {grid} = mountGrid({columns}, rows);

            grid.setFilter('payload', {operator, value, jsonPath});

            expect(names()).toEqual(expected);
        });

        it('filters a JSON column through the popover, path included', () => {
            mountGrid({columns}, rows);
            openFilter('payload');

            applyFilter({path: 'a.b', op: 'equals', value: 'BYE'});

            expect(names()).toEqual(['object']);
        });
    });
});
