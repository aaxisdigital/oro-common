import $ from 'jquery';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import Dialog from '../../../../Resources/js-src/app/widgets/dialog';

describe('Dialog', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
            cb(0);
            return 1;
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        $(document).off('.aaxisDialog .aaxisDialogDrag .aaxisDialogTest');
    });

    it('builds a titled modal in the body and returns the empty content element', () => {
        const $content = new Dialog({title: 'Edit flow'}).open();

        const $modal = $('.aaxis-dialog');
        expect($modal.attr('role')).toBe('dialog');
        expect($modal.attr('aria-modal')).toBe('true');
        expect($modal.hasClass('is-open')).toBe(true);
        expect($modal.find('.aaxis-dialog__title').text()).toBe('Edit flow');
        expect($modal.find('.aaxis-dialog__subtitle')).toHaveLength(0);
        expect($content.is('.aaxis-dialog__body')).toBe(true);
        expect($content.children()).toHaveLength(0);
    });

    it('applies the optional subtitle, size and body class', () => {
        new Dialog({title: 'T', subtitle: 'Sub', width: '500px', height: '300px', bodyClass: 'extra'}).open();

        expect($('.aaxis-dialog__subtitle').text()).toBe('Sub');
        const $dialog = $('.aaxis-dialog__dialog');
        expect($dialog.css('width')).toBe('500px');
        expect($dialog.css('height')).toBe('300px');
        expect($('.aaxis-dialog__body').hasClass('extra')).toBe(true);
    });

    it('is not movable unless asked to be', () => {
        new Dialog({title: 'T'}).open();

        expect($('.aaxis-dialog__head').hasClass('aaxis-dialog__head--movable')).toBe(false);
        expect($('[data-role="drag-handle"]')).toHaveLength(0);
    });

    it.each([
        ['the close button', '.aaxis-dialog__close'],
        ['the backdrop', '.aaxis-dialog__backdrop']
    ])('closes when %s is clicked, then removes itself after the fade-out', (_name, selector) => {
        const onClose = vi.fn();
        new Dialog({title: 'T', onClose}).open();

        $(selector).trigger('click');

        expect($('.aaxis-dialog').hasClass('is-open')).toBe(false);
        expect(onClose).toHaveBeenCalledTimes(1);
        expect($('.aaxis-dialog')).toHaveLength(1);
        vi.advanceTimersByTime(180);
        expect($('.aaxis-dialog')).toHaveLength(0);
    });

    it('closes on Escape but ignores other keys', () => {
        const onClose = vi.fn();
        new Dialog({title: 'T', onClose}).open();

        $(document).trigger($.Event('keydown', {key: 'Enter'}));
        expect(onClose).not.toHaveBeenCalled();

        $(document).trigger($.Event('keydown', {key: 'Escape'}));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes only once and works without an onClose callback', () => {
        const dialog = new Dialog({title: 'T'});
        dialog.open();

        dialog.close();
        expect(() => dialog.close()).not.toThrow();
    });

    it('does nothing when closing a dialog that was never opened', () => {
        const onClose = vi.fn();

        new Dialog({title: 'T', onClose}).close();

        expect(onClose).not.toHaveBeenCalled();
    });

    describe('when movable', () => {
        function openMovable(): void {
            new Dialog({title: 'T', movable: true}).open();
            const dialog = $('.aaxis-dialog__dialog').get(0) as HTMLElement;
            dialog.getBoundingClientRect = () => ({left: 100, top: 80} as DOMRect);
            vi.spyOn($.fn, 'outerWidth').mockReturnValue(400 as any);
            Object.defineProperty(window, 'innerWidth', {value: 1000, configurable: true});
            Object.defineProperty(window, 'innerHeight', {value: 800, configurable: true});
        }

        it('marks the header as a drag handle', () => {
            openMovable();

            const $head = $('.aaxis-dialog__head');
            expect($head.hasClass('aaxis-dialog__head--movable')).toBe(true);
            expect($head.attr('data-role')).toBe('drag-handle');
        });

        it('pins the dialog to its current box on mousedown and then follows the pointer', () => {
            openMovable();
            const $dialog = $('.aaxis-dialog__dialog');

            $('.aaxis-dialog__head').trigger($.Event('mousedown', {clientX: 150, clientY: 100}));
            expect($dialog.css('position')).toBe('fixed');
            expect($dialog.css('left')).toBe('100px');
            expect($dialog.css('top')).toBe('80px');

            $(document).trigger($.Event('mousemove', {clientX: 350, clientY: 300}));
            expect($dialog.css('left')).toBe('300px');
            expect($dialog.css('top')).toBe('280px');
        });

        it('keeps a sliver of the dialog on screen in every direction', () => {
            openMovable();
            const $dialog = $('.aaxis-dialog__dialog');
            $('.aaxis-dialog__head').trigger($.Event('mousedown', {clientX: 150, clientY: 100}));

            $(document).trigger($.Event('mousemove', {clientX: -5000, clientY: -5000}));
            expect($dialog.css('left')).toBe('-376px');
            expect($dialog.css('top')).toBe('0px');

            $(document).trigger($.Event('mousemove', {clientX: 9000, clientY: 9000}));
            expect($dialog.css('left')).toBe('976px');
            expect($dialog.css('top')).toBe('776px');
        });

        it('stops following the pointer after mouseup', () => {
            openMovable();
            const $dialog = $('.aaxis-dialog__dialog');
            $('.aaxis-dialog__head').trigger($.Event('mousedown', {clientX: 150, clientY: 100}));
            $(document).trigger($.Event('mouseup'));

            $(document).trigger($.Event('mousemove', {clientX: 600, clientY: 600}));

            expect($dialog.css('left')).toBe('100px');
        });

        it('ignores a pointer move that was already queued when the dialog closed mid-drag', () => {
            const dialog = new Dialog({title: 'T', movable: true});
            // Bound before the drag starts, so it runs first for the same mousemove and closes the
            // dialog; jQuery has already queued the drag handler by then, so it still fires.
            $(document).on('mousemove.aaxisDialogTest', () => dialog.close());
            dialog.open();
            const el = $('.aaxis-dialog__dialog').get(0) as HTMLElement;
            el.getBoundingClientRect = () => ({left: 100, top: 80} as DOMRect);
            $('.aaxis-dialog__head').trigger($.Event('mousedown', {clientX: 150, clientY: 100}));

            expect(() => $(document).trigger($.Event('mousemove', {clientX: 400, clientY: 400}))).not.toThrow();

            expect($('.aaxis-dialog').hasClass('is-open')).toBe(false);
            expect(el.style.left).toBe('100px');
            expect(el.style.top).toBe('80px');
        });

        it('does not start a drag from the close button', () => {
            openMovable();

            $('.aaxis-dialog__close').trigger($.Event('mousedown', {clientX: 1, clientY: 1}));

            expect($('.aaxis-dialog__dialog').css('position')).not.toBe('fixed');
        });

        it('ends an in-flight drag when the dialog closes', () => {
            const dialog = new Dialog({title: 'T', movable: true});
            dialog.open();
            const el = $('.aaxis-dialog__dialog').get(0) as HTMLElement;
            el.getBoundingClientRect = () => ({left: 0, top: 0} as DOMRect);
            $('.aaxis-dialog__head').trigger($.Event('mousedown', {clientX: 5, clientY: 5}));

            dialog.close();

            const events = ($ as any)._data(document, 'events') ?? {};
            expect(events.mousemove).toBeUndefined();
        });
    });
});
