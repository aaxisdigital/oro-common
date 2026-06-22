export interface DialogOptions {
    title: string;
    subtitle?: string;
    /** Initial dialog width (CSS value). The dialog is resizable. */
    width?: string;
    /** Called once when the dialog is closed. */
    onClose?: () => void;
}
/**
 * Minimal, reusable modal dialog. Open it and fill the returned content element with anything.
 * One instance per open; it cleans itself up on close.
 */
export default class Dialog {
    private readonly opts;
    private $modal;
    private $content;
    constructor(options: DialogOptions);
    /** Builds and shows the dialog; returns the (empty) content element to populate. */
    open(): any;
    close(): void;
}
