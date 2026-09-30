import $ from 'jquery';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import Select2View from 'oroform/js/app/views/select2-view';
import type {FormField} from '../../../../Resources/js-src/app/widgets/record-form-modal';
import {control, flush, openForm, submit} from './support/record-form';

// Records every enhancement the modal asks for; `failWith` simulates Select2 being unavailable.
vi.mock('oroform/js/app/views/select2-view', () => {
    class FakeSelect2View {
        static instances: FakeSelect2View[] = [];
        static failWith: Error | null = null;
        dispose = vi.fn();

        constructor(public options: any) {
            if (FakeSelect2View.failWith) {
                throw FakeSelect2View.failWith;
            }
            FakeSelect2View.instances.push(this);
        }
    }

    return {default: FakeSelect2View};
});

const Fake = Select2View as any;

const field = (type: FormField['type'], extra: Partial<FormField> = {}): FormField => ({key: 'f', label: 'Field', type, ...extra});

async function submittedValues(): Promise<Record<string, any>> {
    submit();
    await flush();

    return openedSubmit.mock.calls[0][0];
}

let openedSubmit: ReturnType<typeof vi.fn>;

function open(fields: FormField[], values?: Record<string, any>): void {
    openedSubmit = vi.fn();
    openForm({fields, values, onSubmit: openedSubmit});
}

beforeEach(() => {
    Fake.instances.length = 0;
    Fake.failWith = null;
});

describe('RecordFormModal text fields', () => {
    it('renders a text input carrying the placeholder, with autofill and spellcheck off', () => {
        open([field('text', {placeholder: 'Type here'})]);

        const $input = control('f');
        expect($input.is('input')).toBe(true);
        expect($input.attr('type')).toBe('text');
        expect($input.attr('placeholder')).toBe('Type here');
        expect($input.attr('autocomplete')).toBe('off');
        expect($input.hasClass('aaxis-rfm__control')).toBe(true);
    });

    it('treats an unknown field type as text', () => {
        open([field('weird' as any)]);

        expect(control('f').attr('type')).toBe('text');
    });

    it('trims the text it submits', async () => {
        open([field('text')], {f: '  padded  '});

        expect((await submittedValues()).f).toBe('padded');
    });

    it('shows a value of 0 rather than treating it as missing', () => {
        open([field('text')], {f: 0});

        expect(control('f').val()).toBe('0');
    });

    it('marks required fields with an asterisk hidden from assistive tech', () => {
        open([field('text', {required: true})]);

        const $req = $('.aaxis-rfm__label .aaxis-rfm__req');
        expect($req.text()).toBe(' *');
        expect($req.attr('aria-hidden')).toBe('true');
    });

    it('adds no asterisk to optional fields', () => {
        open([field('text')]);

        expect($('.aaxis-rfm__req')).toHaveLength(0);
    });

    it('renders a hint under the control only when given', () => {
        open([field('text', {hint: 'Leave empty to keep it'})]);
        expect($('.aaxis-rfm__hint').text()).toBe('Leave empty to keep it');
        expect(control('f').next('.aaxis-rfm__hint')).toHaveLength(1);

        $('.aaxis-rfm').remove();
        open([field('text')]);
        expect($('.aaxis-rfm__hint')).toHaveLength(0);
    });

    it('gives every field a polite error slot', () => {
        open([field('text')]);

        const $error = $('.aaxis-rfm__field-error');
        expect($error.attr('data-role')).toBe('error');
        expect($error.attr('aria-live')).toBe('polite');
    });
});

describe('RecordFormModal textarea fields', () => {
    it('renders a four-row textarea with its value', () => {
        open([field('textarea', {placeholder: 'Notes'})], {f: 'line1\nline2'});

        const $ta = control('f');
        expect($ta.is('textarea')).toBe(true);
        expect($ta.attr('rows')).toBe('4');
        expect($ta.attr('placeholder')).toBe('Notes');
        expect($ta.val()).toBe('line1\nline2');
    });

    it('trims the text it submits', async () => {
        open([field('textarea')], {f: '\n body \n'});

        expect((await submittedValues()).f).toBe('body');
    });
});

describe('RecordFormModal password fields', () => {
    it('renders a masked input with a show/hide eye, never autofilled', () => {
        open([field('password')], {f: 'secret'});

        const $input = control('f');
        expect($input.attr('type')).toBe('password');
        expect($input.attr('data-type')).toBe('password');
        expect($input.attr('autocomplete')).toBe('new-password');
        expect($input.val()).toBe('secret');
        expect($input.parent().hasClass('aaxis-rfm__password')).toBe(true);
        const $toggle = $('[data-role="password-toggle"]');
        expect($toggle.attr('type')).toBe('button');
        expect($toggle.attr('title')).toBe('aaxis.common.grid.show_value');
        expect($toggle.find('.fa').hasClass('fa-eye')).toBe(true);
    });

    it('reveals and re-masks the value with the eye toggle, updating its label and icon', () => {
        open([field('password')], {f: 'secret'});
        const $toggle = $('[data-role="password-toggle"]');

        $toggle.trigger('click');
        expect(control('f').attr('type')).toBe('text');
        expect($toggle.attr('title')).toBe('aaxis.common.grid.hide_value');
        expect($toggle.attr('aria-label')).toBe('aaxis.common.grid.hide_value');
        expect($toggle.find('.fa').hasClass('fa-eye-slash')).toBe(true);
        expect($toggle.find('.fa').hasClass('fa-eye')).toBe(false);

        $toggle.trigger('click');
        expect(control('f').attr('type')).toBe('password');
        expect($toggle.attr('title')).toBe('aaxis.common.grid.show_value');
        expect($toggle.find('.fa').hasClass('fa-eye')).toBe(true);
        expect(control('f').val()).toBe('secret');
    });

    it('submits the password untrimmed, whether shown or hidden', async () => {
        open([field('password')], {f: '  spaced pw  '});
        $('[data-role="password-toggle"]').trigger('click');

        expect((await submittedValues()).f).toBe('  spaced pw  ');
    });

    it('does not submit the form when the eye is clicked', () => {
        open([field('password')]);
        const event = $.Event('click');

        $('[data-role="password-toggle"]').trigger(event);

        expect(event.isDefaultPrevented()).toBe(true);
        expect(openedSubmit).not.toHaveBeenCalled();
    });
});

describe('RecordFormModal number fields', () => {
    it('renders a number input with min and max attributes when given', () => {
        open([field('number', {min: 0, max: 10})], {f: 5});

        const $input = control('f');
        expect($input.attr('type')).toBe('number');
        expect($input.attr('min')).toBe('0');
        expect($input.attr('max')).toBe('10');
        expect($input.val()).toBe('5');
    });

    it('leaves min and max off when not configured', () => {
        open([field('number')]);

        expect(control('f').attr('min')).toBeUndefined();
        expect(control('f').attr('max')).toBeUndefined();
    });

    it.each([
        ['42', 42],
        ['-1.5', -1.5],
        ['0', 0],
        ['', null]
    ])('submits "%s" as %s', async (typed, expected) => {
        open([field('number')]);
        control('f').val(typed);

        expect((await submittedValues()).f).toBe(expected);
    });
});

describe('RecordFormModal boolean fields', () => {
    it('renders a switch reflecting the initial value', () => {
        open([field('boolean', {key: 'on'}), field('boolean', {key: 'off'})], {on: true, off: false});

        expect(control('on').attr('type')).toBe('checkbox');
        expect(control('on').closest('label').hasClass('aaxis-rfm__switch')).toBe(true);
        expect(control('on').prop('checked')).toBe(true);
        expect(control('off').prop('checked')).toBe(false);
        expect($('.aaxis-rfm__switch-thumb')).toHaveLength(2);
    });

    it('submits true or false', async () => {
        open([field('boolean', {key: 'a'}), field('boolean', {key: 'b'})], {a: true});
        control('b').prop('checked', true);
        control('a').prop('checked', false);

        expect(await submittedValues()).toEqual({a: false, b: true});
    });
});

describe('RecordFormModal select fields', () => {
    const options = [{value: 'a', label: 'Option A'}, {value: 'b', label: 'Option B'}];

    it('renders the options with the current one selected', () => {
        open([field('select', {options})], {f: 'b'});

        const $select = control('f');
        expect($select.is('select')).toBe(true);
        expect($select.find('option').map((_i, el) => $(el).text()).get()).toEqual(['Option A', 'Option B']);
        expect($select.val()).toBe('b');
    });

    it('renders an empty select when no options are given', () => {
        open([field('select')]);

        expect(control('f').find('option')).toHaveLength(0);
    });

    it('submits the chosen value, or an empty string when the current value matches no option', async () => {
        open([field('select', {options})], {f: 'zzz'});

        expect((await submittedValues()).f).toBe('');
    });

    it('upgrades every select into a searchable Select2 combobox that spans the field', () => {
        open([field('select', {key: 's1', options}), field('select', {key: 's2', options}), field('text', {key: 't'})]);

        expect(Fake.instances).toHaveLength(2);
        expect(Fake.instances[0].options.el.is('select[data-field="s1"]')).toBe(true);
        expect(Fake.instances[0].options.select2Config).toEqual({width: '100%', minimumResultsForSearch: 0});
    });

    it('keeps the native select when Select2 is unavailable', () => {
        Fake.failWith = new Error('select2 missing');

        open([field('select', {options})], {f: 'a'});

        expect(control('f').is('select')).toBe(true);
        expect(control('f').val()).toBe('a');
    });

    it('disposes the Select2 views on close, even when one of them throws', () => {
        open([field('select', {key: 's1', options}), field('select', {key: 's2', options})]);
        Fake.instances[0].dispose.mockImplementation(() => {
            throw new Error('already gone');
        });

        expect(() => $('.aaxis-rfm__cancel').trigger('click')).not.toThrow();

        expect(Fake.instances[0].dispose).toHaveBeenCalledTimes(1);
        expect(Fake.instances[1].dispose).toHaveBeenCalledTimes(1);
    });
});

describe('RecordFormModal disabled fields', () => {
    it.each([
        ['text', field('text', {disabled: true})],
        ['textarea', field('textarea', {disabled: true})],
        ['number', field('number', {disabled: true})],
        ['boolean', field('boolean', {disabled: true})],
        ['select', field('select', {disabled: true, options: [{value: 'a', label: 'A'}]})],
        ['password', field('password', {disabled: true})]
    ])('disables the %s control', (_type, disabledField) => {
        open([disabledField]);

        expect(control('f').prop('disabled')).toBe(true);
    });

    it('disables the eye of a disabled password field too', () => {
        open([field('password', {disabled: true})]);

        expect($('[data-role="password-toggle"]').prop('disabled')).toBe(true);
    });

    it('leaves enabled controls editable', () => {
        open([field('text'), field('password', {key: 'p'})]);

        expect(control('f').prop('disabled')).toBe(false);
        expect($('[data-role="password-toggle"]').prop('disabled')).toBe(false);
    });

    it('still collects the value of a disabled field on submit', async () => {
        open([field('text', {disabled: true})], {f: 'kept'});

        expect((await submittedValues()).f).toBe('kept');
    });
});
