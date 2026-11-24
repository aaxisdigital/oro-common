import $ from 'jquery';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import Select2View from 'oroform/js/app/views/select2-view';
import type {FormField, SelectPickerApi} from '../../../../Resources/js-src/app/widgets/record-form-modal';
import {control, fieldError, flush, openForm, submit} from './support/record-form';

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
const OPTIONS = [{value: '1', label: 'Alpha'}, {value: '2', label: 'Beta'}, {value: '3', label: 'Gamma'}];

const filter = (): any => $('.aaxis-rfm [data-role="picker-filter"]');
const listed = (): string[] => $('[data-role="picker-list"] button').map((_i: number, el: HTMLElement) => el.textContent).get();
const option = (label: string): HTMLElement => $('[data-role="picker-option"]')
    .filter((_i: number, el: HTMLElement) => el.textContent === label)[0];

function pickerField(extra: Partial<FormField> = {}, picker: FormField['picker'] = {}): FormField {
    return {key: 'system', label: 'System', type: 'select', required: true, options: [...OPTIONS], picker, ...extra};
}

beforeEach(() => {
    Fake.instances.length = 0;
});

describe('RecordFormModal type-to-filter picker', () => {
    it('renders a filter box in front of a hidden value select that Select2 leaves alone', () => {
        openForm({fields: [pickerField({}, {placeholder: 'Type…'})], values: {system: '2'}});

        expect(control('system').is('select')).toBe(true);
        expect(control('system').prop('hidden')).toBe(true);
        expect(control('system').val()).toBe('2');
        expect(filter().val()).toBe('Beta');
        expect(filter().attr('placeholder')).toBe('Type…');
        expect(Fake.instances).toHaveLength(0);
        // No refresh button without a `refresh`.
        expect($('.aaxis-rfm [data-role="picker-refresh"]')).toHaveLength(0);
    });

    it('lists everything for the text showing the pick, and filters what is typed', () => {
        openForm({fields: [pickerField()], values: {system: '2'}});

        filter().trigger('focus');
        expect(listed()).toEqual(['Alpha', 'Beta', 'Gamma']);
        expect($('[data-role="picker-list"] .is-selected').text()).toBe('Beta');
        filter().val('MM').trigger('input');
        expect(listed()).toEqual(['Gamma']);
        filter().val('zzz').trigger('input');
        expect($('.aaxis-rfm__picker-empty').text()).toBe('aaxis.common.grid.picker_no_match');
    });

    it('picks on pointerdown, firing the field change, and restores the label on blur', () => {
        const onFieldChange = vi.fn();
        openForm({fields: [pickerField()], onFieldChange});

        filter().trigger('focus');
        option('Gamma').dispatchEvent(new MouseEvent('pointerdown', {bubbles: true, cancelable: true}));

        expect(control('system').val()).toBe('3');
        expect(filter().val()).toBe('Gamma');
        expect($('[data-role="picker-list"]').prop('hidden')).toBe(true);
        expect(onFieldChange).toHaveBeenCalledWith(expect.objectContaining({key: 'system', value: '3'}));

        filter().trigger('focus').val('Al').trigger('input');
        filter().trigger('blur');
        vi.advanceTimersByTime(200);
        expect(filter().val()).toBe('Gamma');
    });

    it('takes the first match on Enter without submitting', () => {
        const onSubmit = vi.fn();
        openForm({fields: [pickerField()], onSubmit});

        filter().trigger('focus').val('et').trigger('input');
        filter().trigger($.Event('keydown', {key: 'Enter'}));

        expect(control('system').val()).toBe('2');
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('validates like a select and shows the error on the filter box', async () => {
        const onSubmit = vi.fn();
        openForm({fields: [pickerField()], onSubmit});

        submit();
        await flush();

        expect(onSubmit).not.toHaveBeenCalled();
        expect(fieldError('system')).toBe('aaxis.common.grid.required');
        expect(filter().hasClass('error')).toBe(true);

        filter().trigger('focus');
        option('Alpha').dispatchEvent(new MouseEvent('pointerdown', {bubbles: true, cancelable: true}));
        submit();
        await flush();
        expect(onSubmit).toHaveBeenCalledWith({system: '1'});
    });

    it('reloads the options, keeping the pick while it exists and dropping it otherwise', async () => {
        const onFieldChange = vi.fn();
        const refresh = vi.fn()
            .mockResolvedValueOnce([...OPTIONS, {value: '4', label: 'Delta'}])
            .mockResolvedValueOnce([{value: '4', label: 'Delta'}]);
        openForm({fields: [pickerField({}, {refresh})], values: {system: '2'}, onFieldChange});
        const $refresh = $('.aaxis-rfm [data-role="picker-refresh"]');

        $refresh.trigger('click');
        expect($refresh.prop('disabled')).toBe(true);
        await flush();
        expect($refresh.prop('disabled')).toBe(false);
        expect(control('system').val()).toBe('2');
        filter().trigger('focus');
        expect(listed()).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta']);
        expect(onFieldChange).not.toHaveBeenCalled();

        $refresh.trigger('click');
        await flush();
        expect(control('system').val()).toBe('');
        expect(filter().val()).toBe('');
        expect(onFieldChange).toHaveBeenCalledWith(expect.objectContaining({key: 'system', value: ''}));
    });

    it('keeps the old options when a reload fails', async () => {
        openForm({fields: [pickerField({}, {refresh: () => Promise.reject(new Error('down'))})], values: {system: '1'}});

        $('.aaxis-rfm [data-role="picker-refresh"]').trigger('click');
        await flush();

        filter().trigger('focus');
        expect(listed()).toEqual(['Alpha', 'Beta', 'Gamma']);
        expect($('.aaxis-rfm [data-role="picker-refresh"]').prop('disabled')).toBe(false);
    });

    it('closes the list with "Add new …", handing the live picker to the consumer', async () => {
        let api: SelectPickerApi | null = null;
        const refresh = vi.fn().mockResolvedValue([...OPTIONS, {value: '9', label: 'Zeta'}]);
        openForm({fields: [pickerField({}, {refresh, addNew: {label: 'Add new system…', onAdd: a => {
            api = a;
        }}})]});

        filter().trigger('focus');
        expect(listed()).toEqual(['Alpha', 'Beta', 'Gamma', 'Add new system…']);
        $('[data-role="picker-add"]')[0].dispatchEvent(new MouseEvent('pointerdown', {bubbles: true, cancelable: true}));

        expect($('[data-role="picker-list"]').prop('hidden')).toBe(true);
        expect(api!.values()).toEqual(['1', '2', '3']);
        await api!.refresh();
        expect(api!.values()).toEqual(['1', '2', '3', '9']);
        api!.pick('9');
        expect(control('system').val()).toBe('9');
        expect(filter().val()).toBe('Zeta');
    });

    it('survives a rebuild: the API resolves the picker rendered now', () => {
        let api: SelectPickerApi | null = null;
        const form = openForm({
            fields: [pickerField({}, {addNew: {label: 'Add', onAdd: a => {
                api = a;
            }}})],
            values: {system: '1'},
            onFieldChange: ctx => ctx.api.rebuildFields([pickerField({}, {addNew: {label: 'Add', onAdd: a => {
                api = a;
            }}}), {key: 'note', label: 'Note', type: 'text'}])
        });
        void form;
        filter().trigger('focus');
        $('[data-role="picker-add"]')[0].dispatchEvent(new MouseEvent('pointerdown', {bubbles: true, cancelable: true}));

        api!.pick('3'); // fires the change → the form rebuilds
        expect($('.aaxis-rfm [data-field="note"]')).toHaveLength(1);
        api!.pick('2');
        expect(control('system').val()).toBe('2');
        expect(filter().val()).toBe('Beta');
    });

    it('opens the list at body level, fixed under its box, closed by a form scroll and removed with the form', () => {
        const form = openForm({fields: [pickerField()]});
        filter().trigger('focus');
        const $list = $('[data-role="picker-list"]');
        expect($list.parent().is('body')).toBe(true);
        expect($list.css('position')).toBe('fixed');

        $list[0].dispatchEvent(new Event('scroll'));
        expect($list.prop('hidden')).toBe(false);
        $('.aaxis-rfm__body')[0].dispatchEvent(new Event('scroll'));
        expect($list.prop('hidden')).toBe(true);

        form.close();
        expect($('[data-role="picker-list"]')).toHaveLength(0);
    });

    it('disables the filter box and the refresh button of a disabled field', () => {
        openForm({fields: [pickerField({disabled: true}, {refresh: () => Promise.resolve([])})], values: {system: '1'}});

        expect(filter().prop('disabled')).toBe(true);
        expect($('.aaxis-rfm [data-role="picker-refresh"]').prop('disabled')).toBe(true);
        expect(control('system').prop('disabled')).toBe(true);
    });
});
