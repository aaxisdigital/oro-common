import BaseComponent from 'oroui/js/app/components/base/component';
interface ConnectionTestOptions {
    _sourceElement: any;
    tool: string;
}
/**
 * Renders a "Test it" button next to a tool's "Enabled" setting in System Configuration.
 *
 * The component replaces its (unused) backing input with a button + result area, and calls the
 * connection-test endpoint for the configured tool. Passwords are never returned by the backend.
 */
declare class ConnectionTestComponent extends BaseComponent {
    private $el;
    private tool;
    private $button;
    private $result;
    initialize(options: ConnectionTestOptions): void;
    private onTest;
    /**
     * Collects the sibling config field values for this tool from the form, keyed by their short
     * name (e.g. "url", "user", "pass", "name"), so a test can run against unsaved input.
     *
     * Field names are derived from this control's own name (e.g. "aaxis_tools[bucket_browser_test][value]")
     * so it does not depend on the form's id scheme.
     */
    private collectOverrides;
    private render;
    dispose(): void;
}
export default ConnectionTestComponent;
