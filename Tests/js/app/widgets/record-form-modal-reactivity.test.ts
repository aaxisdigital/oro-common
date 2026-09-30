import $ from 'jquery';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import Select2View from 'oroform/js/app/views/select2-view';
import type {FieldChangeContext, FormField} from '../../../../Resources/js-src/app/widgets/record-form-modal';
import {control, flush, openForm, submit} from './support/record-form';

vi.mock('oroform/js/app/views/select2-view', () => {
    class FakeSelect2View {
        static instances: FakeSelect2View[] = [];
        dispose = vi.fn();

        constructor(public options: any) {
            FakeSelect2View.instances.push(this);
        }
    }

    return {default: FakeSelect2View};
});

const Fake = Select2View as any;

const text = (key: string, extra: Partial<FormField> = {}): FormField => ({key, label: key.toUpperCase(), type: 'text', ...extra});

beforeEach(() => {
    Fake.instances.length = 0;
});

/** Opens the form with a recording onFieldChange; `calls` holds every context received. */
function openReactive(fields: FormField[], values?: Record<string, any>): {calls: FieldChangeContext[]; onSubmit: ReturnType<typeof vi.fn>} {
    const calls: FieldChangeContext[] = [];
    const onSubmit = vi.fn();
    openForm({fields, values, onSubmit, onFieldChange: ctx => calls.push(ctx)});

    return {calls, onSubmit};
}

const collection = (): FormField => ({
    key: 'rows',
    label: 'Rows',
    type: 'collection',
    fields: [
        text('name'),
        {key: 'label', label: 'Label', type: 'text'},
        {key: 'flag', label: 'Flag', type: 'boolean'}
    ]
});

describe('RecordFormModal onFieldChange', () => {
    it('reports the key and value of a changed text field, trimmed', () => {
        const {calls} = openReactive([text('name')]);

        control('name').val('  Acme ').trigger('change');

        expect(calls).toHaveLength(1);
        expect(calls[0].key).toBe('name');
        expect(calls[0].value).toBe('Acme');
        expect(calls[0].collectionKey).toBeUndefined();
    });

    it('reports a select choice', () => {
        const {calls} = openReactive([{key: 'kind', label: 'Kind', type: 'select', options: [{value: 'a', label: 'A'}, {value: 'b', label: 'B'}]}]);

        control('kind').val('b').trigger('change');

        expect(calls[0].value).toBe('b');
    });

    it('reports a switch as a boolean', () => {
        const {calls} = openReactive([{key: 'on', label: 'On', type: 'boolean'}]);

        control('on').prop('checked', true).trigger('change');
        control('on').prop('checked', false).trigger('change');

        expect(calls.map(c => c.value)).toEqual([true, false]);
    });

    it.each([
        ['a number as a number', '7.5', 7.5],
        ['an empty number as null', '', null],
        ['zero as zero', '0', 0]
    ])('reports %s', (_name, typed, expected) => {
        const {calls} = openReactive([{key: 'qty', label: 'Qty', type: 'number'}]);

        control('qty').val(typed).trigger('change');

        expect(calls[0].value).toBe(expected);
    });

    it('reports a password exactly as typed', () => {
        const {calls} = openReactive([{key: 'pw', label: 'PW', type: 'password'}]);

        control('pw').val(' pw ').trigger('change');
        $('[data-role="password-toggle"]').trigger('click');
        control('pw').val('  again ').trigger('change');

        expect(calls.map(c => c.value)).toEqual([' pw ', '  again ']);
    });

    it('names the collection when the change happened inside one of its rows', () => {
        const {calls} = openReactive([collection()], {rows: [{name: 'one'}]});

        control('name').val('two').trigger('change');

        expect(calls[0].key).toBe('name');
        expect(calls[0].value).toBe('two');
        expect(calls[0].collectionKey).toBe('rows');
    });

    it('also reports changes inside rows added later', () => {
        const {calls} = openReactive([collection()]);
        $('[data-role="add-row"]').trigger('click');

        control('name').val('fresh').trigger('change');

        expect(calls).toHaveLength(1);
        expect(calls[0].collectionKey).toBe('rows');
    });

    it('is optional', () => {
        openForm({fields: [text('name')], onSubmit: vi.fn()});

        expect(() => control('name').val('x').trigger('change')).not.toThrow();
    });

    it('offers the current values, collections included', () => {
        const {calls} = openReactive([text('name'), collection()], {name: 'Acme', rows: [{name: 'r1', label: 'L'}]});

        control('name').val('Globex').trigger('change');

        expect(calls[0].api.values()).toEqual({name: 'Globex', rows: [{name: 'r1', label: 'L', flag: false}]});
    });
});

describe('RecordFormModal setRowValue', () => {
    it('sets a sibling control in the same row', () => {
        const {calls} = openReactive([collection()], {rows: [{name: 'a'}, {name: 'b'}]});
        control('name').val('changed').trigger('change');

        calls[0].api.setRowValue('label', 'auto');

        const $rows = $('[data-role="collection-rows"] tr');
        expect($rows.eq(0).find('[data-field="label"]').val()).toBe('auto');
        expect($rows.eq(1).find('[data-field="label"]').val()).toBe('');
    });

    it('targets the row of the control that changed, not the first row', () => {
        const {calls} = openReactive([collection()], {rows: [{name: 'a'}, {name: 'b'}]});
        $('[data-role="collection-rows"] tr').eq(1).find('[data-field="name"]').val('B2').trigger('change');

        calls[0].api.setRowValue('label', 'second');

        const $rows = $('[data-role="collection-rows"] tr');
        expect($rows.eq(0).find('[data-field="label"]').val()).toBe('');
        expect($rows.eq(1).find('[data-field="label"]').val()).toBe('second');
    });

    it('does not re-fire onFieldChange for its own programmatic change', () => {
        const {calls} = openReactive([collection()], {rows: [{name: 'a'}]});
        control('name').val('x').trigger('change');

        calls[0].api.setRowValue('label', 'auto');

        expect(calls).toHaveLength(1);
    });

    it('still notifies for later user changes after a programmatic one', () => {
        const {calls} = openReactive([collection()], {rows: [{name: 'a'}]});
        control('name').val('x').trigger('change');
        calls[0].api.setRowValue('label', 'auto');

        control('label').val('typed').trigger('change');

        expect(calls).toHaveLength(2);
    });

    it('checks and unchecks a switch in the row', () => {
        const {calls} = openReactive([collection()], {rows: [{name: 'a'}]});
        control('name').val('x').trigger('change');

        calls[0].api.setRowValue('flag', true);
        expect(control('flag').prop('checked')).toBe(true);

        calls[0].api.setRowValue('flag', 0);
        expect(control('flag').prop('checked')).toBe(false);
    });

    it('fires a native change on the control so widgets wrapped around it (Select2) stay in sync', () => {
        const {calls} = openReactive([collection()], {rows: [{name: 'a'}]});
        control('name').val('x').trigger('change');
        const seen = vi.fn();
        control('label').on('change', seen);
        control('flag').on('change', seen);

        calls[0].api.setRowValue('label', 'auto');
        calls[0].api.setRowValue('flag', true);

        expect(seen).toHaveBeenCalledTimes(2);
    });

    it('writes null as an empty string and other values as text', () => {
        const {calls} = openReactive([collection()], {rows: [{name: 'a', label: 'old'}]});
        control('name').val('x').trigger('change');

        calls[0].api.setRowValue('label', null);
        expect(control('label').val()).toBe('');

        calls[0].api.setRowValue('label', 42);
        expect(control('label').val()).toBe('42');
    });

    it('ignores a key the row does not have', () => {
        const {calls} = openReactive([collection()], {rows: [{name: 'a'}]});
        control('name').val('x').trigger('change');

        expect(() => calls[0].api.setRowValue('missing', 'x')).not.toThrow();
    });

    it('does nothing for a change outside any collection', () => {
        const {calls} = openReactive([text('name'), text('label')]);
        control('name').val('x').trigger('change');

        calls[0].api.setRowValue('label', 'auto');

        expect(control('label').val()).toBe('');
    });
});

describe('RecordFormModal rebuildFields', () => {
    it('re-renders the body with the new schema, keeping what the user already typed', () => {
        const {calls} = openReactive([text('name'), text('city')], {city: 'Oslo'});
        control('name').val('Acme').trigger('change');

        calls[0].api.rebuildFields([
            text('name'),
            {key: 'city', label: 'City', type: 'select', options: [{value: 'Oslo', label: 'Oslo'}, {value: 'Rome', label: 'Rome'}]}
        ]);

        expect($('.aaxis-rfm__body > .aaxis-rfm__field')).toHaveLength(2);
        expect(control('name').val()).toBe('Acme');
        expect(control('city').is('select')).toBe(true);
        expect(control('city').val()).toBe('Oslo');
    });

    it('drops fields that left the schema and shows new ones empty', () => {
        const {calls} = openReactive([text('name'), text('old')], {old: 'x'});
        control('name').val('go').trigger('change');

        calls[0].api.rebuildFields([text('name'), text('fresh')]);

        expect(control('old')).toHaveLength(0);
        expect(control('fresh').val()).toBe('');
    });

    it('keeps collection rows across a rebuild', () => {
        const {calls} = openReactive([text('name'), collection()], {rows: [{name: 'r1'}, {name: 'r2'}]});
        control('name').val('go').trigger('change');

        calls[0].api.rebuildFields([text('name'), collection()]);

        expect($('[data-role="collection-rows"] tr')).toHaveLength(2);
    });

    it('submits against the new schema', async () => {
        const {calls, onSubmit} = openReactive([text('name')]);
        control('name').val('go').trigger('change');
        calls[0].api.rebuildFields([text('name'), text('extra')]);
        control('extra').val('added');

        submit();
        await flush();

        expect(onSubmit).toHaveBeenCalledWith({name: 'go', extra: 'added'});
    });

    it('re-upgrades the selects and retires the old Select2 views', () => {
        const select: FormField = {key: 'kind', label: 'Kind', type: 'select', options: [{value: 'a', label: 'A'}]};
        const {calls} = openReactive([text('name'), select]);
        const [previous] = Fake.instances;
        control('name').val('go').trigger('change');

        calls[0].api.rebuildFields([text('name'), select]);

        expect(previous.dispose).toHaveBeenCalledTimes(1);
        expect(Fake.instances).toHaveLength(2);
    });

    it('survives a Select2 view that throws while being retired', () => {
        const select: FormField = {key: 'kind', label: 'Kind', type: 'select', options: [{value: 'a', label: 'A'}]};
        const {calls} = openReactive([text('name'), select]);
        Fake.instances[0].dispose.mockImplementation(() => {
            throw new Error('gone');
        });
        control('name').val('go').trigger('change');

        expect(() => calls[0].api.rebuildFields([text('name'), select])).not.toThrow();
    });

    it('does not report the rebuild itself as a field change', () => {
        const {calls} = openReactive([text('name')]);
        control('name').val('go').trigger('change');

        calls[0].api.rebuildFields([text('name')]);

        expect(calls).toHaveLength(1);
    });
});
