import $ from 'jquery';
import {describe, expect, it, vi} from 'vitest';
import type {FormField, RecordFormOptions, TestOutcome} from '../../../../Resources/js-src/app/widgets/record-form-modal';
import {$modal, alertText, control, fieldError, flush, openForm, submit} from './support/record-form';

const text = (key: string, extra: Partial<FormField> = {}): FormField => ({key, label: key.toUpperCase(), type: 'text', ...extra});
const number = (key: string, extra: Partial<FormField> = {}): FormField => ({key, label: key.toUpperCase(), type: 'number', ...extra});

const spinner = (): any => $('.aaxis-rfm__submit-spinner');
const submitButton = (): any => $('[data-role="submit"]');

describe('RecordFormModal validation', () => {
    it('blocks the submit and flags a missing required field', async () => {
        const onSubmit = vi.fn();
        openForm({onSubmit, fields: [text('name', {required: true})]});

        submit();
        await flush();

        expect(onSubmit).not.toHaveBeenCalled();
        expect(fieldError('name')).toBe('aaxis.common.grid.required');
        expect(control('name').hasClass('error')).toBe(true);
        expect(spinner()).toHaveLength(0);
        expect($modal().hasClass('is-open')).toBe(true);
    });

    it('counts whitespace as missing', async () => {
        const onSubmit = vi.fn();
        openForm({onSubmit, fields: [text('name', {required: true})]});
        control('name').val('   ');

        submit();
        await flush();

        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('flags an empty required number, but accepts zero', async () => {
        const onSubmit = vi.fn();
        openForm({onSubmit, fields: [number('qty', {required: true})]});

        submit();
        expect(fieldError('qty')).toBe('aaxis.common.grid.required');

        control('qty').val('0');
        submit();
        await flush();
        expect(onSubmit).toHaveBeenCalledWith({qty: 0});
    });

    it('is satisfied by a required switch whether it is on or off', async () => {
        const onSubmit = vi.fn();
        openForm({onSubmit, fields: [{key: 'ok', label: 'OK', type: 'boolean', required: true}]});

        submit();
        await flush();

        expect(onSubmit).toHaveBeenCalledWith({ok: false});
    });

    it('reports every invalid field at once', () => {
        openForm({fields: [text('a', {required: true}), text('b'), text('c', {required: true})]});

        submit();

        expect(fieldError('a')).toBe('aaxis.common.grid.required');
        expect(fieldError('b')).toBe('');
        expect(fieldError('c')).toBe('aaxis.common.grid.required');
    });

    it('clears an error once the value is fixed', async () => {
        const onSubmit = vi.fn();
        openForm({onSubmit, fields: [text('name', {required: true})]});
        submit();

        control('name').val('Acme');
        submit();
        await flush();

        expect(fieldError('name')).toBe('');
        expect(control('name').hasClass('error')).toBe(false);
        expect(onSubmit).toHaveBeenCalledWith({name: 'Acme'});
    });

    it.each([
        ['below the minimum', {min: 5}, '3', 'aaxis.common.grid.number_min'],
        ['above the maximum', {max: 10}, '11', 'aaxis.common.grid.number_max'],
        ['below a range', {min: 5, max: 10}, '4', 'aaxis.common.grid.number_range'],
        ['above a range', {min: 5, max: 10}, '11', 'aaxis.common.grid.number_range'],
        ['below a minimum of zero', {min: 0}, '-1', 'aaxis.common.grid.number_min']
    ])('rejects a number %s', (_name, limits, typed, message) => {
        const onSubmit = vi.fn();
        openForm({onSubmit, fields: [number('qty', limits)]});
        control('qty').val(typed);

        submit();

        expect(fieldError('qty')).toBe(message);
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it.each([
        ['the minimum', {min: 5, max: 10}, '5'],
        ['the maximum', {min: 5, max: 10}, '10'],
        ['zero against a minimum of zero', {min: 0}, '0'],
        ['a value with no limits', {}, '999'],
        ['an empty optional number', {min: 5}, '']
    ])('accepts %s', async (_name, limits, typed) => {
        const onSubmit = vi.fn();
        openForm({onSubmit, fields: [number('qty', limits)]});
        control('qty').val(typed);

        submit();
        await flush();

        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('lets a disabled field through unvalidated, and still submits its value', async () => {
        const onSubmit = vi.fn();
        openForm({
            onSubmit,
            fields: [text('name', {required: true, disabled: true}), number('qty', {min: 5, disabled: true})],
            values: {qty: 1}
        });

        submit();
        await flush();

        expect(onSubmit).toHaveBeenCalledWith({name: '', qty: 1});
        expect(fieldError('name')).toBe('');
    });
});

describe('RecordFormModal submit', () => {
    it('hands the collected values to onSubmit and closes when it resolves', async () => {
        const onSubmit = vi.fn(() => Promise.resolve());
        openForm({onSubmit, fields: [text('name'), text('city')], values: {name: 'Acme', city: 'Oslo'}});

        submit();
        await flush();

        expect(onSubmit).toHaveBeenCalledWith({name: 'Acme', city: 'Oslo'});
        expect($modal().hasClass('is-open')).toBe(false);
        vi.advanceTimersByTime(180);
        expect($modal()).toHaveLength(0);
    });

    it('also accepts a synchronous onSubmit', async () => {
        openForm({onSubmit: () => undefined, fields: [text('name')]});

        submit();
        await flush();

        expect($modal().hasClass('is-open')).toBe(false);
    });

    it('shows a busy spinner in the disabled submit button while saving', async () => {
        let finish!: () => void;
        openForm({onSubmit: () => new Promise<void>(resolve => { finish = resolve; }), fields: [text('name')]});

        submit();
        await flush();

        expect(spinner()).toHaveLength(1);
        expect(spinner().parent().is(submitButton())).toBe(true);
        expect(spinner().attr('aria-hidden')).toBe('true');
        expect(submitButton().prop('disabled')).toBe(true);

        finish();
        await flush();
        expect(spinner()).toHaveLength(0);
    });

    it('ignores a second submit while the first is still saving', async () => {
        const onSubmit = vi.fn(() => new Promise<void>(() => undefined));
        openForm({onSubmit, fields: [text('name')]});

        submit();
        await flush();
        submit();
        await flush();

        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(spinner()).toHaveLength(1);
    });

    it('stays open and shows the error when saving fails, then lets the user retry', async () => {
        const onSubmit = vi.fn()
            .mockRejectedValueOnce(new Error('Name already taken'))
            .mockResolvedValueOnce(undefined);
        openForm({onSubmit, fields: [text('name')]});

        submit();
        await flush();

        expect(alertText()).toBe('Name already taken');
        expect($('.aaxis-rfm__alert').attr('hidden')).toBeUndefined();
        expect($modal().hasClass('is-open')).toBe(true);
        expect(spinner()).toHaveLength(0);
        expect(submitButton().prop('disabled')).toBe(false);

        submit();
        await flush();

        expect(onSubmit).toHaveBeenCalledTimes(2);
        expect($modal().hasClass('is-open')).toBe(false);
    });

    it('clears the previous error as soon as the next attempt starts', async () => {
        const onSubmit = vi.fn()
            .mockRejectedValueOnce(new Error('Boom'))
            .mockImplementationOnce(() => new Promise<void>(() => undefined));
        openForm({onSubmit, fields: [text('name')]});
        submit();
        await flush();

        submit();
        await flush();

        expect(alertText()).toBe('');
        expect($('.aaxis-rfm__alert').attr('hidden')).toBe('hidden');
    });

    it.each([
        ['an error without a message', new Error('')],
        ['a rejection with a bare string', 'oops'],
        ['an empty rejection', undefined]
    ])('falls back to the generic message for %s', async (_name, reason) => {
        openForm({onSubmit: () => Promise.reject(reason), fields: [text('name')]});

        submit();
        await flush();

        expect(alertText()).toBe('aaxis.common.grid.save_error');
    });

    it('shows the failure when onSubmit throws synchronously', async () => {
        openForm({
            onSubmit: () => {
                throw new Error('sync failure');
            },
            fields: [text('name')]
        });

        submit();
        await flush();

        expect(alertText()).toBe('sync failure');
    });

    it('copes with the dialog being closed while the save is in flight', async () => {
        let fail!: (e: Error) => void;
        const form = openForm({onSubmit: () => new Promise<void>((_resolve, reject) => { fail = reject; }), fields: [text('name')]});
        submit();
        await flush();
        form.close();

        fail(new Error('too late'));

        await expect(flush()).resolves.toBeUndefined();
        expect(spinner()).toHaveLength(0);
    });

    it('reads top-level fields even when a collection sub-field shares their key', async () => {
        const onSubmit = vi.fn();
        openForm({
            onSubmit,
            fields: [
                {key: 'items', label: 'Items', type: 'collection', fields: [text('name')]},
                text('name', {required: true})
            ],
            values: {name: 'top-level', items: [{name: 'in-row'}]}
        });

        submit();
        await flush();

        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(onSubmit.mock.calls[0][0]).toEqual({items: [{name: 'in-row'}], name: 'top-level'});
    });
});

describe('RecordFormModal test action', () => {
    const outcome = (result: TestOutcome): NonNullable<RecordFormOptions['testAction']> => ({
        label: 'Test connection',
        onTest: vi.fn(() => Promise.resolve(result))
    });

    const testButton = (): any => $('[data-role="test"]');
    const result = (): any => $('.aaxis-rfm__test-result');

    it('adds no test button or result area without a testAction', () => {
        openForm({fields: [text('name')]});

        expect(testButton()).toHaveLength(0);
        expect(result()).toHaveLength(0);
    });

    it('puts the test button on the left of Cancel and Submit', () => {
        openForm({fields: [text('name')], testAction: outcome({success: true})});

        expect(testButton().text()).toBe('Test connection');
        expect(testButton().attr('type')).toBe('button');
        expect($('.aaxis-rfm__actions').children().first().hasClass('aaxis-rfm__test')).toBe(true);
        expect($('.aaxis-rfm__actions').children()).toHaveLength(3);
        expect(result().attr('hidden')).toBe('hidden');
    });

    it('runs the test with the current values, unvalidated', async () => {
        const testAction = outcome({success: true});
        openForm({fields: [text('name', {required: true}), number('qty', {min: 5})], testAction});
        control('qty').val('1');

        testButton().trigger('click');
        await flush();

        expect(testAction.onTest).toHaveBeenCalledWith({name: '', qty: 1});
        expect(fieldError('name')).toBe('');
    });

    it('does not submit the form when the test button is clicked', () => {
        const onSubmit = vi.fn();
        openForm({fields: [text('name')], onSubmit, testAction: outcome({success: true})});
        const event = $.Event('click');

        testButton().trigger(event);

        expect(event.isDefaultPrevented()).toBe(true);
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('shows a busy state while the test runs and restores the button afterwards', async () => {
        let finish!: (o: TestOutcome) => void;
        openForm({
            fields: [text('name')],
            testAction: {label: 'Test', onTest: () => new Promise<TestOutcome>(resolve => { finish = resolve; })}
        });

        testButton().trigger('click');
        await flush();
        expect(testButton().prop('disabled')).toBe(true);
        expect($('[data-role="test-status"]').text()).toBe('aaxis.common.grid.testing');
        expect(result().attr('hidden')).toBe('hidden');

        finish({success: true});
        await flush();
        expect(testButton().prop('disabled')).toBe(false);
        expect($('[data-role="test-status"]').text()).toBe('');
    });

    it('ignores another click while a test is running', async () => {
        const testAction = {label: 'Test', onTest: vi.fn(() => new Promise<TestOutcome>(() => undefined))};
        openForm({fields: [text('name')], testAction});

        testButton().trigger('click');
        await flush();
        testButton().trigger('click');
        await flush();

        expect(testAction.onTest).toHaveBeenCalledTimes(1);
    });

    it('shows a success line with the default message', async () => {
        openForm({fields: [text('name')], testAction: outcome({success: true})});

        testButton().trigger('click');
        await flush();

        const $line = $('.aaxis-rfm__test-line');
        expect(result().attr('hidden')).toBeUndefined();
        expect($line.hasClass('is-ok')).toBe(true);
        expect($line.find('.fa').hasClass('fa-check-circle')).toBe(true);
        expect($line.text().trim()).toBe('aaxis.common.grid.test_success');
    });

    it('shows a failure line with the outcome message, or the default one', async () => {
        openForm({fields: [text('name')], testAction: outcome({success: false, message: 'Connection refused'})});
        testButton().trigger('click');
        await flush();

        expect($('.aaxis-rfm__test-line').hasClass('is-fail')).toBe(true);
        expect($('.aaxis-rfm__test-line .fa').hasClass('fa-times-circle')).toBe(true);
        expect($('.aaxis-rfm__test-line').text().trim()).toBe('Connection refused');
    });

    it('falls back to the default failure text when the outcome carries no message', async () => {
        openForm({fields: [text('name')], testAction: outcome({success: false})});

        testButton().trigger('click');
        await flush();

        expect($('.aaxis-rfm__test-line').text().trim()).toBe('aaxis.common.grid.test_error');
    });

    it('lists the steps below the summary, each with its own verdict and message', async () => {
        openForm({
            fields: [text('name')],
            testAction: outcome({
                success: false,
                message: 'Failed',
                steps: [
                    {label: 'DNS', success: true},
                    {label: 'Login', success: false, message: 'bad password'}
                ]
            })
        });

        testButton().trigger('click');
        await flush();

        const $steps = $('.aaxis-rfm__test-step');
        expect($steps).toHaveLength(2);
        expect($steps.eq(0).hasClass('is-ok')).toBe(true);
        expect($steps.eq(0).text().trim()).toBe('DNS');
        expect($steps.eq(1).hasClass('is-fail')).toBe(true);
        expect($steps.eq(1).find('.fa').hasClass('fa-times-circle')).toBe(true);
        expect($steps.eq(1).text().trim()).toBe('Login — bad password');
    });

    it('replaces the previous outcome on a re-run', async () => {
        const onTest = vi.fn()
            .mockResolvedValueOnce({success: false, message: 'first', steps: [{label: 's', success: false}]})
            .mockResolvedValueOnce({success: true, message: 'second'});
        openForm({fields: [text('name')], testAction: {label: 'Test', onTest}});
        testButton().trigger('click');
        await flush();

        testButton().trigger('click');
        expect(result().attr('hidden')).toBe('hidden');
        expect(result().children()).toHaveLength(0);
        await flush();

        expect($('.aaxis-rfm__test-line')).toHaveLength(1);
        expect($('.aaxis-rfm__test-line').text().trim()).toBe('second');
        expect($('.aaxis-rfm__test-step')).toHaveLength(0);
    });

    it.each([
        ['an Error message', () => Promise.reject(new Error('timeout')), 'timeout'],
        ['a synchronous throw', () => {
            throw new Error('exploded');
        }, 'exploded'],
        ['a rejection without a message', () => Promise.reject(new Error('')), 'aaxis.common.grid.test_error'],
        ['an empty rejection', () => Promise.reject(undefined), 'aaxis.common.grid.test_error']
    ])('reports %s as a failed test', async (_name, onTest, expected) => {
        openForm({fields: [text('name')], testAction: {label: 'Test', onTest: onTest as any}});

        testButton().trigger('click');
        await flush();

        expect($('.aaxis-rfm__test-line').hasClass('is-fail')).toBe(true);
        expect($('.aaxis-rfm__test-line').text().trim()).toBe(expected);
        expect(testButton().prop('disabled')).toBe(false);
    });

    it('copes with the dialog being closed while the test runs', async () => {
        let finish!: (o: TestOutcome) => void;
        const form = openForm({
            fields: [text('name')],
            testAction: {label: 'Test', onTest: () => new Promise<TestOutcome>(resolve => { finish = resolve; })}
        });
        testButton().trigger('click');
        await flush();
        form.close();

        finish({success: true});

        await expect(flush()).resolves.toBeUndefined();
    });
});
