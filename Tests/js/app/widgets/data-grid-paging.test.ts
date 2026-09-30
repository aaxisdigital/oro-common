import $ from 'jquery';
import {afterEach, describe, expect, it} from 'vitest';
import type {GridColumn} from '../../../../Resources/js-src/app/widgets/data-grid';
import {columnTexts, mountGrid} from './support/data-grid';

const columns: GridColumn[] = [{key: 'name', label: 'Name'}];

function makeRows(count: number): any[] {
    return Array.from({length: count}, (_v, i) => ({id: i + 1, name: 'row' + (i + 1)}));
}

const page = (): string => $('[data-role="page-number"]').text();
const prev = (): any => $('[data-role="prev"]');
const next = (): any => $('[data-role="next"]');

function typePage(text: string, key = 'Enter'): void {
    const $page = $('[data-role="page-number"]').text(text);
    $page.trigger($.Event('keydown', {key}));
}

describe('DataGrid pager', () => {
    it('defaults to 25 rows per page with the standard size choices', () => {
        mountGrid({columns}, makeRows(30));

        expect($('[data-role="page-size"] option').map((_i, el) => $(el).attr('value')).get()).toEqual(['10', '25', '50', '100']);
        expect($('[data-role="page-size"]').val()).toBe('25');
        expect(columnTexts('name')).toHaveLength(25);
    });

    it('honours custom page sizes and size choices', () => {
        mountGrid({columns, pageSize: 5, pageSizeOptions: [5, 15]}, makeRows(12));

        expect($('[data-role="page-size"] option').map((_i, el) => $(el).attr('value')).get()).toEqual(['5', '15']);
        expect($('[data-role="page-size"]').val()).toBe('5');
        expect(columnTexts('name')).toHaveLength(5);
    });

    it('hides itself when there is nothing to page through', () => {
        mountGrid({columns}, []);

        expect($('.aaxis-grid__pager').attr('hidden')).toBe('hidden');
    });

    it('shows the current page and disables the arrows at either end', () => {
        mountGrid({columns, pageSize: 10}, makeRows(25));

        expect($('.aaxis-grid__pager').attr('hidden')).toBeUndefined();
        expect(page()).toBe('1');
        expect(prev().prop('disabled')).toBe(true);
        expect(next().prop('disabled')).toBe(false);

        next().trigger('click');
        expect(page()).toBe('2');
        expect(prev().prop('disabled')).toBe(false);
        expect(next().prop('disabled')).toBe(false);

        next().trigger('click');
        expect(page()).toBe('3');
        expect(next().prop('disabled')).toBe(true);
        expect(columnTexts('name')).toEqual(['row21', 'row22', 'row23', 'row24', 'row25']);
    });

    it('steps back with the previous arrow and never goes below the first page', () => {
        mountGrid({columns, pageSize: 10}, makeRows(25));
        next().trigger('click');

        prev().trigger('click');
        expect(columnTexts('name')[0]).toBe('row1');

        prev().trigger('click');
        expect(page()).toBe('1');
    });

    it('never goes past the last page', () => {
        mountGrid({columns, pageSize: 10}, makeRows(15));
        next().trigger('click');

        next().trigger('click');

        expect(page()).toBe('2');
    });

    it('re-slices from the first page when the page size changes', () => {
        mountGrid({columns, pageSize: 10}, makeRows(40));
        next().trigger('click');
        next().trigger('click');

        $('[data-role="page-size"]').val('25').trigger('change');

        expect(page()).toBe('1');
        expect(columnTexts('name')).toHaveLength(25);
    });

    describe('typing a page number', () => {
        it('jumps there on Enter', () => {
            mountGrid({columns, pageSize: 10}, makeRows(45));

            typePage('4');

            expect(page()).toBe('4');
            expect(columnTexts('name')[0]).toBe('row31');
        });

        it('jumps there when the box loses focus', () => {
            mountGrid({columns, pageSize: 10}, makeRows(45));

            $('[data-role="page-number"]').text('3').trigger('focusout');

            expect(page()).toBe('3');
        });

        it('ignores other keys', () => {
            mountGrid({columns, pageSize: 10}, makeRows(45));

            typePage('4', '4');

            expect(columnTexts('name')[0]).toBe('row1');
        });

        it('clamps to the last page', () => {
            mountGrid({columns, pageSize: 10}, makeRows(45));

            typePage('99');

            expect(page()).toBe('5');
        });

        it.each(['0', '-3'])('clamps %s to the first page', (text) => {
            mountGrid({columns, pageSize: 10}, makeRows(45));
            next().trigger('click');

            typePage(text);

            expect(page()).toBe('1');
        });

        it('restores the displayed page when the text is not a number', () => {
            mountGrid({columns, pageSize: 10}, makeRows(45));
            next().trigger('click');

            typePage('abc');

            expect(page()).toBe('2');
            expect(columnTexts('name')[0]).toBe('row11');
        });

        it('reads leading digits like parseInt', () => {
            mountGrid({columns, pageSize: 10}, makeRows(45));

            typePage('3rd');

            expect(page()).toBe('3');
        });
    });

    it('falls back to the last page when the rows shrink underneath the current one', () => {
        const {grid} = mountGrid({columns, pageSize: 10}, makeRows(45));
        typePage('5');

        grid.setRows(makeRows(12));

        expect(page()).toBe('2');
        expect(columnTexts('name')).toEqual(['row11', 'row12']);
    });
});

describe('DataGrid scroll container', () => {
    const originalHeight = window.innerHeight;

    afterEach(() => {
        Object.defineProperty(window, 'innerHeight', {value: originalHeight, configurable: true});
    });

    function scrollEl(): HTMLElement {
        return $('.aaxis-grid__scroll').get(0)!;
    }

    function place(top: number, viewport: number): void {
        scrollEl().getBoundingClientRect = () => ({top} as DOMRect);
        Object.defineProperty(window, 'innerHeight', {value: viewport, configurable: true});
    }

    it('wraps the table so a long grid scrolls internally', () => {
        mountGrid({columns}, makeRows(3));

        expect($('.aaxis-grid__scroll > table')).toHaveLength(1);
        expect($('.aaxis-grid__scroll').css('max-height')).not.toBe('');
    });

    it('caps its height between its top edge and the viewport bottom when the window resizes', () => {
        mountGrid({columns}, makeRows(3));
        place(100, 800);

        $(window).trigger('resize');

        expect($('.aaxis-grid__scroll').css('max-height')).toBe('676px');
    });

    it('never shrinks below 220px', () => {
        mountGrid({columns}, makeRows(3));
        place(700, 800);

        $(window).trigger('resize');

        expect($('.aaxis-grid__scroll').css('max-height')).toBe('220px');
    });

    it('refits after each body render, since the pager can shift the table down', () => {
        const {grid} = mountGrid({columns}, makeRows(3));
        place(200, 800);

        grid.setRows(makeRows(4));

        expect($('.aaxis-grid__scroll').css('max-height')).toBe('576px');
    });

    it('leaves a container that is no longer in the document alone', () => {
        const {$container} = mountGrid({columns}, makeRows(3));
        place(100, 800);
        $(window).trigger('resize');
        const el = scrollEl();
        $container.detach();
        Object.defineProperty(window, 'innerHeight', {value: 500, configurable: true});

        $(window).trigger('resize');

        expect(el.style.maxHeight).toBe('676px');
    });

    it('stops following window resizes once disposed', () => {
        const {grid} = mountGrid({columns}, makeRows(3));
        place(100, 800);
        $(window).trigger('resize');
        const el = scrollEl();
        grid.dispose();
        Object.defineProperty(window, 'innerHeight', {value: 500, configurable: true});

        $(window).trigger('resize');

        expect(el.style.maxHeight).toBe('676px');
    });
});
