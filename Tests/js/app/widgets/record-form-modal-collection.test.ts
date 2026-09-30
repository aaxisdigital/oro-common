import $ from 'jquery';
import {describe, expect, it, vi} from 'vitest';
import type {FormField} from '../../../../Resources/js-src/app/widgets/record-form-modal';
import {flush, openForm, submit} from './support/record-form';

const items = (extra: Partial<FormField> = {}): FormField => ({
    key: 'items',
    label: 'Items',
    type: 'collection',
    fields: [
        {key: 'name', label: 'Name', type: 'text', required: true, width: '180px'},
        {key: 'qty', label: 'Qty', type: 'number'},
        {key: 'on', label: 'On', type: 'boolean'},
        {key: 'kind', label: 'Kind', type: 'select', options: [{value: 'a', label: 'A'}, {value: 'b', label: 'B'}]}
    ],
    ...extra
});

const rowsInDom = (): any => $('[data-collection="items"] [data-role="collection-rows"] tr');

async function submitted(): Promise<Record<string, any>> {
    submit();
    await flush();

    return onSubmit.mock.calls[0][0];
}

let onSubmit: ReturnType<typeof vi.fn>;

function open(fields: FormField[], values?: Record<string, any>): void {
    onSubmit = vi.fn();
    openForm({fields, values, onSubmit});
}

describe('RecordFormModal collections', () => {
    it('renders a titled table with a header cell per sub-field plus an actions column', () => {
        open([items()]);

        expect($('.aaxis-rfm__collection-title').text()).toBe('Items');
        const $headers = $('.aaxis-rfm__collection-table thead th');
        expect($headers).toHaveLength(5);
        expect($headers.slice(0, 4).map((_i, el) => $(el).clone().children().remove().end().text()).get())
            .toEqual(['Name', 'Qty', 'On', 'Kind']);
        expect($headers.eq(0).get(0)!.style.width).toBe('180px');
        expect($headers.eq(0).find('.aaxis-rfm__req')).toHaveLength(1);
        expect($headers.eq(1).find('.aaxis-rfm__req')).toHaveLength(0);
        expect($headers.eq(2).hasClass('aaxis-rfm__collection-col--center')).toBe(true);
        expect($headers.eq(4).hasClass('aaxis-rfm__collection-actions')).toBe(true);
    });

    it('starts without rows when the value is missing or not an array', () => {
        open([items()], {items: 'nope'});

        expect(rowsInDom()).toHaveLength(0);
    });

    it('renders one row per value, with the sub-field controls filled in', () => {
        open([items()], {items: [{name: 'Bolt', qty: 4, on: true, kind: 'b'}, {name: 'Nut'}]});

        const $rows = rowsInDom();
        expect($rows).toHaveLength(2);
        const $first = $rows.eq(0);
        expect($first.find('[data-field="name"]').val()).toBe('Bolt');
        expect($first.find('[data-field="qty"]').val()).toBe('4');
        expect($first.find('[data-field="on"]').prop('checked')).toBe(true);
        expect($first.find('[data-field="kind"]').val()).toBe('b');
        expect($first.find('td').eq(2).hasClass('aaxis-rfm__collection-col--center')).toBe(true);
        expect($rows.eq(1).find('[data-field="name"]').val()).toBe('Nut');
        expect($rows.eq(1).find('[data-field="on"]').prop('checked')).toBe(false);
    });

    it('tolerates null entries among the rows', () => {
        open([items()], {items: [null]});

        expect(rowsInDom()).toHaveLength(1);
        expect(rowsInDom().find('[data-field="name"]').val()).toBe('');
    });

    it('uses the add label, or a default one', () => {
        open([items({addLabel: 'Add item'})]);
        expect($('[data-role="add-row"]').text().trim()).toBe('Add item');

        $('.aaxis-rfm').remove();
        open([items()]);
        expect($('[data-role="add-row"]').text().trim()).toBe('aaxis.common.grid.add_row');
    });

    it('appends an empty row when the add button is clicked, and upgrades its select', () => {
        open([items()]);

        $('[data-role="add-row"]').trigger('click');
        $('[data-role="add-row"]').trigger('click');

        expect(rowsInDom()).toHaveLength(2);
        expect(rowsInDom().eq(1).find('[data-field="name"]').val()).toBe('');
        expect(rowsInDom().eq(1).find('select[data-field="kind"]').data('aaxis-select2')).toBe(true);
    });

    it('does not submit the form when adding or removing a row', () => {
        open([items()], {items: [{name: 'Bolt'}]});
        const add = $.Event('click');
        const remove = $.Event('click');

        $('[data-role="add-row"]').trigger(add);
        $('[data-role="remove-row"]').first().trigger(remove);

        expect(add.isDefaultPrevented()).toBe(true);
        expect(remove.isDefaultPrevented()).toBe(true);
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('adds rows only to the collection whose button was clicked', () => {
        open([items(), items({key: 'other', label: 'Other'})]);

        $('[data-role="add-row"][data-collection="other"]').trigger('click');

        expect(rowsInDom()).toHaveLength(0);
        expect($('[data-collection="other"] [data-role="collection-rows"] tr')).toHaveLength(1);
    });

    it('removes just the row whose trash button was clicked', () => {
        open([items()], {items: [{name: 'One'}, {name: 'Two'}, {name: 'Three'}]});

        rowsInDom().eq(1).find('[data-role="remove-row"]').trigger('click');

        expect(rowsInDom().map((_i: number, tr: any) => $(tr).find('[data-field="name"]').val()).get()).toEqual(['One', 'Three']);
    });

    it('labels the remove button for assistive tech', () => {
        open([items()], {items: [{name: 'One'}]});

        const $button = $('[data-role="remove-row"]');
        expect($button.attr('aria-label')).toBe('Delete');
        expect($button.attr('title')).toBe('Delete');
        expect($button.find('.fa').hasClass('fa-trash-o')).toBe(true);
    });

    it('submits the rows as an array of objects, typed per sub-field', async () => {
        open([items()], {items: [{name: '  Bolt ', qty: 4, on: true, kind: 'b'}, {name: 'Nut', qty: null, on: false, kind: 'a'}]});
        rowsInDom().eq(1).find('[data-field="qty"]').val('12');

        expect((await submitted()).items).toEqual([
            {name: 'Bolt', qty: 4, on: true, kind: 'b'},
            {name: 'Nut', qty: 12, on: false, kind: 'a'}
        ]);
    });

    it('drops rows where every field is empty', async () => {
        open([{
            key: 'items', label: 'Items', type: 'collection',
            fields: [{key: 'name', label: 'Name', type: 'text'}, {key: 'qty', label: 'Qty', type: 'number'}]
        }], {items: [{name: 'Keep'}, {}, {qty: 3}]});
        $('[data-role="add-row"]').trigger('click');

        expect((await submitted()).items).toEqual([
            {name: 'Keep', qty: null},
            {name: '', qty: 3}
        ]);
    });

    it('keeps a row whose only content is a switch, since a switch always has a value', async () => {
        open([items()], {items: [{}]});

        expect((await submitted()).items).toHaveLength(1);
    });

    it('submits an empty array for a collection without rows', async () => {
        open([items()]);

        expect((await submitted()).items).toEqual([]);
    });

    it('does not validate collection sub-fields, even required ones', async () => {
        open([items()], {items: [{qty: 2}]});

        // A select with no value selects nothing (there is no empty option), so it reads back as ''.
        expect((await submitted()).items).toEqual([{name: '', qty: 2, on: false, kind: ''}]);
    });

    it('disables the controls of a disabled sub-field but still collects them', async () => {
        open([{
            key: 'items', label: 'Items', type: 'collection',
            fields: [{key: 'name', label: 'Name', type: 'text', disabled: true}]
        }], {items: [{name: 'Fixed'}]});

        expect(rowsInDom().find('[data-field="name"]').prop('disabled')).toBe(true);
        expect((await submitted()).items).toEqual([{name: 'Fixed'}]);
    });

    it('collects several collections independently', async () => {
        open([items(), items({key: 'other', label: 'Other'})], {items: [{name: 'A'}], other: [{name: 'B'}, {name: 'C'}]});

        const values = await submitted();

        expect(values.items.map((r: any) => r.name)).toEqual(['A']);
        expect(values.other.map((r: any) => r.name)).toEqual(['B', 'C']);
    });
});
