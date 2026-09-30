import $ from 'jquery';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import ConnectionTestComponent from '../../../../Resources/js-src/app/components/connection-test-component';

/** A jQuery-style promise stand-in we can settle by hand. */
function deferredAjax() {
    return $.Deferred();
}

describe('ConnectionTestComponent', () => {
    let $source: any;

    beforeEach(() => {
        $source = $('<input type="text" id="backing" value="1">').appendTo(document.body);
    });

    function create(options: Record<string, unknown> = {}) {
        return new (ConnectionTestComponent as any)({_sourceElement: $source, tool: 'redis', ...options});
    }

    it('hides the backing input and renders a test button after it', () => {
        create();

        expect($source.attr('hidden')).toBe('hidden');
        expect($source.css('display')).toBe('none');
        const $wrap = $source.next('.aaxis-conn-test');
        expect($wrap.find('button.btn').text()).toBe('aaxis.common.connection_test.button');
        expect($wrap.find('.aaxis-conn-test__result').attr('aria-live')).toBe('polite');
    });

    it('shows the "save first" hint only for tools with editable connection settings', () => {
        create();
        expect(document.querySelector('.aaxis-conn-test__hint')).toBeNull();

        $(document.body).empty();
        $source = $('<input>').appendTo(document.body);
        create({editableConnection: true});
        expect(document.querySelector('.aaxis-conn-test__hint')?.textContent)
            .toBe('aaxis.common.connection_test.saved_only_hint');
    });

    it('tests the saved configuration only, never sending form values', () => {
        const ajax = vi.spyOn($, 'ajax').mockReturnValue(deferredAjax() as any);
        create({tool: 'mongo'});

        $('.aaxis-conn-test button').trigger('click');

        expect(ajax).toHaveBeenCalledWith({url: '/aaxis_common_connection_test?tool=mongo', method: 'GET'});
        expect($('.aaxis-conn-test button').prop('disabled')).toBe(true);
        expect($('.aaxis-conn-test__result').text()).toBe('aaxis.common.connection_test.running');
    });

    it('renders a successful result with its non-empty details', () => {
        const request = deferredAjax();
        vi.spyOn($, 'ajax').mockReturnValue(request as any);
        create();
        $('.aaxis-conn-test button').trigger('click');

        request.resolve({success: true, message: 'Connected', details: {version: '7.2', empty: '', port: 6379}});

        const $result = $('.aaxis-conn-test__result');
        expect($result.hasClass('aaxis-conn-test__result--ok')).toBe(true);
        expect($result.hasClass('aaxis-conn-test__result--fail')).toBe(false);
        expect($result.find('.aaxis-conn-test__message').text()).toBe('Connected');
        expect($result.find('.fa-check-circle')).toHaveLength(1);
        const items = $result.find('.aaxis-conn-test__details li').map((_, li) => li.textContent).get();
        expect(items).toEqual(['version: 7.2', 'port: 6379']);
        expect($('.aaxis-conn-test button').prop('disabled')).toBe(false);
    });

    it('renders a failed result without a details list when there are none', () => {
        const request = deferredAjax();
        vi.spyOn($, 'ajax').mockReturnValue(request as any);
        create();
        $('.aaxis-conn-test button').trigger('click');

        request.resolve({success: false, message: 'Refused'});

        const $result = $('.aaxis-conn-test__result');
        expect($result.hasClass('aaxis-conn-test__result--fail')).toBe(true);
        expect($result.find('.fa-exclamation-triangle')).toHaveLength(1);
        expect($result.find('.aaxis-conn-test__details')).toHaveLength(0);
    });

    it('tolerates a result without a message', () => {
        const request = deferredAjax();
        vi.spyOn($, 'ajax').mockReturnValue(request as any);
        create();
        $('.aaxis-conn-test button').trigger('click');

        request.resolve({success: false});

        expect($('.aaxis-conn-test__message').text()).toBe('');
    });

    it('shows the server-provided error body when the request fails', () => {
        const request = deferredAjax();
        vi.spyOn($, 'ajax').mockReturnValue(request as any);
        create();
        $('.aaxis-conn-test button').trigger('click');

        request.reject({responseJSON: {success: false, message: 'Forbidden'}});

        expect($('.aaxis-conn-test__message').text()).toBe('Forbidden');
        expect($('.aaxis-conn-test button').prop('disabled')).toBe(false);
    });

    it('falls back to a generic message when the failure has no JSON body', () => {
        const request = deferredAjax();
        vi.spyOn($, 'ajax').mockReturnValue(request as any);
        create();
        $('.aaxis-conn-test button').trigger('click');

        request.reject({});

        expect($('.aaxis-conn-test__message').text()).toBe('aaxis.common.connection_test.failed');
    });

    it('stops reacting to clicks once disposed, and disposing twice is harmless', () => {
        const ajax = vi.spyOn($, 'ajax').mockReturnValue(deferredAjax() as any);
        const component = create();

        component.dispose();
        component.dispose();
        $('.aaxis-conn-test button').trigger('click');

        expect(component.disposed).toBe(true);
        expect(ajax).not.toHaveBeenCalled();
    });
});
