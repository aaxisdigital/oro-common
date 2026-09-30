import $ from 'jquery';
import {describe, expect, it, vi} from 'vitest';
import RecordFormModal, {type FormField} from '../../../../Resources/js-src/app/widgets/record-form-modal';
import {$modal, alertText, control, flush, openForm, submit} from './support/record-form';

const text = (key: string, extra: Partial<FormField> = {}): FormField => ({key, label: key.toUpperCase(), type: 'text', ...extra});

describe('RecordFormModal lifecycle', () => {
    it('builds an accessible modal in the body and fades it in', () => {
        openForm({fields: [text('name')]});

        const $m = $modal();
        expect($m.parent().is('body')).toBe(true);
        expect($m.attr('role')).toBe('dialog');
        expect($m.attr('aria-modal')).toBe('true');
        expect($m.hasClass('is-open')).toBe(true);
    });

    it('shows the title, and the subtitle only when given', () => {
        openForm({title: 'New system', fields: [text('name')]});
        expect($('.aaxis-rfm__title').text()).toBe('New system');
        expect($('.aaxis-rfm__subtitle')).toHaveLength(0);

        openForm({title: 'T', subtitle: 'Fill everything in', fields: [text('other')]});
        expect($('.aaxis-rfm__subtitle').text()).toBe('Fill everything in');
    });

    it('focuses the first field once it is open', () => {
        openForm({fields: [text('first'), text('second')]});

        expect(document.activeElement).toBe(control('first').get(0));
    });

    it('applies a custom width and keeps the resize handle unless told otherwise', () => {
        openForm({width: '640px', fields: [text('name')]});

        const $dialog = $('.aaxis-rfm__dialog');
        expect($dialog.css('width')).toBe('640px');
        expect($dialog.hasClass('aaxis-rfm__dialog--no-resize')).toBe(false);
    });

    it('removes the resize handle for resizable: false', () => {
        openForm({resizable: false, fields: [text('name')]});

        expect($('.aaxis-rfm__dialog').hasClass('aaxis-rfm__dialog--no-resize')).toBe(true);
    });

    it('labels the submit button with the given text, or the default one', () => {
        openForm({submitLabel: 'Create', fields: [text('name')]});
        expect($('[data-role="submit"]').text()).toBe('Create');
        expect($('[data-role="submit"]').attr('type')).toBe('submit');

        $modal().remove();
        openForm({fields: [text('name')]});
        expect($('[data-role="submit"]').text()).toBe('aaxis.common.grid.submit');
    });

    it.each([
        ['the backdrop', '.aaxis-rfm__backdrop'],
        ['the close button', '.aaxis-rfm__close'],
        ['the Cancel button', '.aaxis-rfm__cancel']
    ])('closes when %s is clicked, and removes itself after the fade-out', (_name, selector) => {
        openForm({fields: [text('name')]});

        $(selector).trigger('click');

        expect($modal().hasClass('is-open')).toBe(false);
        expect($modal()).toHaveLength(1);
        vi.advanceTimersByTime(180);
        expect($modal()).toHaveLength(0);
    });

    it('does not submit anything when cancelled', () => {
        const onSubmit = vi.fn();
        openForm({onSubmit, fields: [text('name')]});

        $('.aaxis-rfm__cancel').trigger('click');

        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('closes on Escape but not on other keys', () => {
        openForm({fields: [text('name')]});

        $(document).trigger($.Event('keydown', {key: 'Enter'}));
        expect($modal().hasClass('is-open')).toBe(true);

        $(document).trigger($.Event('keydown', {key: 'Escape'}));
        expect($modal().hasClass('is-open')).toBe(false);
    });

    it('stops listening for Escape once closed', () => {
        const form = openForm({fields: [text('name')]});
        form.close();

        const events = ($ as any)._data(document, 'events') ?? {};
        expect((events.keydown ?? []).some((h: any) => h.namespace === 'aaxisRecordForm')).toBe(false);
    });

    it('can be closed twice, or before it was opened', () => {
        const form = openForm({fields: [text('name')]});
        form.close();

        expect(() => form.close()).not.toThrow();
        expect(() => new RecordFormModal({title: 'T', fields: [], onSubmit: vi.fn()}).close()).not.toThrow();
    });

    it('shows a server error in the alert area, and ignores it before it is open', () => {
        expect(() => new RecordFormModal({title: 'T', fields: [], onSubmit: vi.fn()}).showError('nope')).not.toThrow();

        const form = openForm({fields: [text('name')]});
        expect($('.aaxis-rfm__alert').attr('hidden')).toBe('hidden');
        expect($('.aaxis-rfm__alert').attr('role')).toBe('alert');

        form.showError('Name already taken');

        expect(alertText()).toBe('Name already taken');
        expect($('.aaxis-rfm__alert').attr('hidden')).toBeUndefined();
    });

    it('does not submit natively', () => {
        openForm({fields: [text('name')]});
        const event = $.Event('submit');

        $('[data-role="form"]').trigger(event);

        expect(event.isDefaultPrevented()).toBe(true);
    });

    it('starts with the given values in the controls', () => {
        openForm({fields: [text('name'), text('city')], values: {name: 'Acme', city: null}});

        expect(control('name').val()).toBe('Acme');
        expect(control('city').val()).toBe('');
    });

    it('submits what the user left in the controls', async () => {
        const onSubmit = vi.fn();
        openForm({onSubmit, fields: [text('name')], values: {name: 'Acme'}});
        control('name').val('  Globex ');

        submit();
        await flush();

        expect(onSubmit).toHaveBeenCalledWith({name: 'Globex'});
    });
});

describe('RecordFormModal layout', () => {
    it('stacks fields one per line by default, label above the control', () => {
        openForm({fields: [text('a'), text('b')]});

        const $fields = $('.aaxis-rfm__body > .aaxis-rfm__field');
        expect($fields).toHaveLength(2);
        expect($fields.first().children().first().is('label.aaxis-rfm__label')).toBe(true);
        expect($fields.first().find('label').text()).toBe('A');
        expect($('.aaxis-rfm__row')).toHaveLength(0);
    });

    it('puts consecutive fields sharing a row on one line, in declaration order', () => {
        openForm({fields: [text('a', {row: 'r1'}), text('b', {row: 'r1'}), text('c', {row: 'r1'}), text('d')]});

        const $rows = $('.aaxis-rfm__row');
        expect($rows).toHaveLength(1);
        expect($rows.find('[data-field]').map((_i, el) => $(el).attr('data-field')).get()).toEqual(['a', 'b', 'c']);
        expect($('.aaxis-rfm__body > .aaxis-rfm__field')).toHaveLength(1);
    });

    it('uses the numeric part of a width as the flex ratio inside a row', () => {
        openForm({fields: [text('a', {row: 1, width: '45%'}), text('b', {row: 1, width: '10%'}), text('c', {row: 1, width: 'wide'})]});

        const flex = (key: string): string => (control(key).closest('.aaxis-rfm__field').get(0) as HTMLElement).style.flex;
        expect(flex('a')).toMatch(/^45 1 0/);
        expect(flex('b')).toMatch(/^10 1 0/);
        expect(flex('c')).toMatch(/^1 1 0/);
    });

    it('renders a lone row member full width without a wrapper', () => {
        openForm({fields: [text('a', {row: 'solo'}), text('b')]});

        expect($('.aaxis-rfm__row')).toHaveLength(0);
        expect($('.aaxis-rfm__body > .aaxis-rfm__field')).toHaveLength(2);
    });

    it('only groups a row when its members are adjacent', () => {
        openForm({fields: [text('a', {row: 'r'}), text('b'), text('c', {row: 'r'})]});

        expect($('.aaxis-rfm__row')).toHaveLength(0);
    });

    it('keeps different rows apart', () => {
        openForm({fields: [text('a', {row: 'r1'}), text('b', {row: 'r1'}), text('c', {row: 'r2'}), text('d', {row: 'r2'})]});

        expect($('.aaxis-rfm__row')).toHaveLength(2);
        expect($('.aaxis-rfm__row').first().find('[data-field]')).toHaveLength(2);
    });

    it('never puts a collection on a shared row', () => {
        openForm({
            fields: [
                text('a', {row: 'r'}),
                {key: 'items', label: 'Items', type: 'collection', row: 'r', fields: [text('x')]},
                text('b', {row: 'r'})
            ]
        });

        expect($('.aaxis-rfm__row')).toHaveLength(0);
        expect($('.aaxis-rfm__collection')).toHaveLength(1);
    });

    describe('tabs', () => {
        const tabbed = (): FormField[] => [
            text('intro'),
            text('one', {tabGroup: 'g', tabLabel: 'First tab'}),
            text('two', {tabGroup: 'g'}),
            text('three', {tabGroup: 'g', tabLabel: 'Third'}),
            text('outro')
        ];

        it('renders consecutive fields of a tab group as one tab strip, labelled by tabLabel or label', () => {
            openForm({fields: tabbed()});

            expect($('.aaxis-rfm__tabs')).toHaveLength(1);
            const $tabs = $('.aaxis-rfm__tab-btn');
            expect($tabs.map((_i, el) => $(el).text()).get()).toEqual(['First tab', 'TWO', 'Third']);
            expect($tabs.attr('role')).toBe('tab');
            expect($('.aaxis-rfm__tab-nav').attr('role')).toBe('tablist');
            expect($('.aaxis-rfm__body > .aaxis-rfm__field')).toHaveLength(2);
        });

        it('shows only the first tab, but keeps the other panels in the DOM', () => {
            openForm({fields: tabbed()});

            expect($('.aaxis-rfm__tab-btn').eq(0).hasClass('is-active')).toBe(true);
            expect($('.aaxis-rfm__tab-btn').eq(0).attr('aria-selected')).toBe('true');
            expect($('.aaxis-rfm__tab-btn').eq(1).attr('aria-selected')).toBe('false');
            expect($('[data-tab-panel="one"]').attr('hidden')).toBeUndefined();
            expect($('[data-tab-panel="two"]').attr('hidden')).toBe('hidden');
            expect($('[data-tab-panel="three"]').find('[data-field="three"]')).toHaveLength(1);
        });

        it('switches panel and selection when a tab is clicked', () => {
            openForm({fields: tabbed()});

            $('.aaxis-rfm__tab-btn[data-tab-key="three"]').trigger('click');

            expect($('.aaxis-rfm__tab-btn').map((_i, el) => $(el).hasClass('is-active')).get()).toEqual([false, false, true]);
            expect($('.aaxis-rfm__tab-btn').map((_i, el) => $(el).attr('aria-selected')).get()).toEqual(['false', 'false', 'true']);
            expect($('[data-tab-panel="one"]').attr('hidden')).toBe('hidden');
            expect($('[data-tab-panel="three"]').attr('hidden')).toBeUndefined();
        });

        it('still submits the values typed into hidden tabs', async () => {
            const onSubmit = vi.fn();
            openForm({onSubmit, fields: tabbed()});
            control('two').val('hidden but typed');

            submit();
            await flush();

            expect(onSubmit.mock.calls[0][0].two).toBe('hidden but typed');
        });

        it('keeps separate tab groups apart', () => {
            openForm({fields: [text('a', {tabGroup: 'g1'}), text('b', {tabGroup: 'g1'}), text('c', {tabGroup: 'g2'}), text('d', {tabGroup: 'g2'})]});

            expect($('.aaxis-rfm__tabs')).toHaveLength(2);
        });

        it('lets each strip switch independently', () => {
            openForm({fields: [text('a', {tabGroup: 'g1'}), text('b', {tabGroup: 'g1'}), text('c', {tabGroup: 'g2'}), text('d', {tabGroup: 'g2'})]});

            $('.aaxis-rfm__tab-btn[data-tab-key="b"]').trigger('click');

            expect($('[data-tab-panel="b"]').attr('hidden')).toBeUndefined();
            expect($('[data-tab-panel="c"]').attr('hidden')).toBeUndefined();
            expect($('[data-tab-panel="d"]').attr('hidden')).toBe('hidden');
        });

        it('drops the title of a collection inside a tab, since the tab already names it', () => {
            openForm({
                fields: [
                    {key: 'items', label: 'Items', type: 'collection', tabGroup: 'g', fields: [text('x')]},
                    text('other', {tabGroup: 'g'})
                ]
            });

            expect($('.aaxis-rfm__collection-title')).toHaveLength(0);
        });
    });
});
