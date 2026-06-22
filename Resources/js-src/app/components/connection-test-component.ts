import $ from 'jquery';
import __ from 'orotranslation/js/translator';
import routing from 'routing';
import BaseComponent from 'oroui/js/app/components/base/component';

interface ConnectionTestOptions {
    _sourceElement: any;
    tool: string;
}

interface TestResult {
    success: boolean;
    message: string;
    details?: Record<string, string>;
}

/**
 * Renders a "Test it" button next to a tool's "Enabled" setting in System Configuration.
 *
 * The component replaces its (unused) backing input with a button + result area, and calls the
 * connection-test endpoint for the configured tool. Passwords are never returned by the backend.
 */
class ConnectionTestComponent extends BaseComponent {
    private $el!: any;
    private tool!: string;
    private $button!: any;
    private $result!: any;

    initialize(options: ConnectionTestOptions): void {
        this.$el = options._sourceElement;
        this.tool = options.tool;

        // The backing input carries no real value; hide it and render the control.
        this.$el.attr('hidden', 'hidden').css('display', 'none');

        const $wrap = $('<div/>', {'class': 'aaxis-conn-test'});
        this.$button = $('<button/>', {
            type: 'button',
            'class': 'btn',
            text: __('aaxis.common.connection_test.button')
        });
        this.$result = $('<div/>', {'class': 'aaxis-conn-test__result', 'aria-live': 'polite'});
        $wrap.append(this.$button, this.$result);
        this.$el.after($wrap);

        this.$button.on('click.aaxisConnTest', this.onTest.bind(this));
    }

    private onTest(): void {
        this.$button.prop('disabled', true);
        this.$result
            .removeClass('aaxis-conn-test__result--ok aaxis-conn-test__result--fail')
            .empty()
            .text(__('aaxis.common.connection_test.running'));

        const url = routing.generate('aaxis_common_connection_test', {tool: this.tool});

        // Send the values currently entered in the form so the test works in edit mode
        // (before saving). The backend uses these overrides when present.
        $.ajax({url, method: 'GET', data: {overrides: this.collectOverrides()}})
            .done((response: TestResult) => this.render(response))
            .fail((jqXhr: any) => {
                const response = (jqXhr.responseJSON as TestResult) || {
                    success: false,
                    message: __('aaxis.common.connection_test.failed')
                };
                this.render(response);
            })
            .always(() => this.$button.prop('disabled', false));
    }

    /**
     * Collects the sibling config field values for this tool from the form, keyed by their short
     * name (e.g. "url", "user", "pass", "name"), so a test can run against unsaved input.
     *
     * Field names are derived from this control's own name (e.g. "aaxis_tools[bucket_browser_test][value]")
     * so it does not depend on the form's id scheme.
     */
    private collectOverrides(): Record<string, string> {
        const overrides: Record<string, string> = {};
        const myName = String(this.$el.attr('name') || '');
        const match = myName.match(/^(.*\[)[^\]]*\]\[value\]$/);
        if (!match) {
            return overrides;
        }
        const prefix = match[1] + this.tool + '_'; // e.g. "aaxis_tools[bucket_browser_"
        const suffix = '][value]';
        const $form = this.$el.closest('form');
        const $scope = $form.length ? $form : $(document);

        $scope.find('[name^="' + prefix + '"][name$="' + suffix + '"]').each((_index: number, el: any) => {
            const name = String(el.getAttribute('name') || '');
            const key = name.substring(prefix.length, name.length - suffix.length);
            if (key === '' || key === 'test') {
                return;
            }
            const $field = $(el);
            overrides[key] = $field.is(':checkbox')
                ? ($field.is(':checked') ? '1' : '0')
                : String($field.val() ?? '');
        });
        return overrides;
    }

    private render(response: TestResult): void {
        this.$result
            .empty()
            .toggleClass('aaxis-conn-test__result--ok', !!response.success)
            .toggleClass('aaxis-conn-test__result--fail', !response.success);

        const icon = response.success ? 'fa-check-circle' : 'fa-exclamation-triangle';
        this.$result.append($('<div/>', {'class': 'aaxis-conn-test__message'}).append(
            $('<span/>', {'class': 'fa ' + icon + ' aaxis-conn-test__icon', 'aria-hidden': 'true'}),
            $('<span/>', {text: response.message || ''})
        ));

        const details = response.details || {};
        const keys = Object.keys(details);
        if (keys.length > 0) {
            const $list = $('<ul/>', {'class': 'aaxis-conn-test__details'});
            keys.forEach(key => {
                if (details[key] === '') {
                    return;
                }
                $list.append($('<li/>').append(
                    $('<span/>', {'class': 'aaxis-conn-test__detail-key', text: key + ': '}),
                    $('<span/>', {text: String(details[key])})
                ));
            });
            this.$result.append($list);
        }
    }

    dispose(): void {
        if (this.disposed) {
            return;
        }
        if (this.$button) {
            this.$button.off('.aaxisConnTest');
        }
        super.dispose();
    }
}

export default ConnectionTestComponent;
