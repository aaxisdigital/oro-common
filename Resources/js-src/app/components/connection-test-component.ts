import $ from 'jquery';
import __ from 'orotranslation/js/translator';
import routing from 'routing';
import BaseComponent from 'oroui/js/app/components/base/component';

interface ConnectionTestOptions {
    _sourceElement: any;
    tool: string;
    // True only for tools that expose editable connection settings (DSN/credentials) in the config
    // form. The "save first" hint is shown only then — tools that test a fixed app connection
    // (database, elastic, queue_monitor) have nothing to save, so the hint would be misleading.
    editableConnection?: boolean;
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
 *
 * The test deliberately runs against the *saved* configuration only — it never sends the values
 * currently typed into the form. This avoids probing arbitrary, unsaved hosts/credentials straight
 * from the UI; the user must save first to test new values. For tools that expose editable
 * connection settings (`editableConnection: true`) a hint next to the button says so; tools that
 * test a fixed app connection (database, elastic, queue_monitor) omit it — there's nothing to save.
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
        $wrap.append(this.$button);
        // Only tools with editable connection settings have unsaved values worth warning about.
        if (options.editableConnection) {
            $wrap.append($('<div/>', {
                'class': 'aaxis-conn-test__hint',
                text: __('aaxis.common.connection_test.saved_only_hint')
            }));
        }
        $wrap.append(this.$result);
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

        // Always test against the saved configuration; never send unsaved form input (see the
        // class doc). The backend uses its persisted settings when no overrides are provided.
        $.ajax({url, method: 'GET'})
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
