import $ from 'jquery';
import __ from 'orotranslation/js/translator';

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
    private readonly opts: DialogOptions;
    private $modal: any = null;
    private $content: any = null;

    constructor(options: DialogOptions) {
        this.opts = options;
    }

    /** Builds and shows the dialog; returns the (empty) content element to populate. */
    open(): any {
        const $modal = $('<div/>', {'class': 'aaxis-dialog', role: 'dialog', 'aria-modal': 'true'});
        $modal.append($('<div/>', {'class': 'aaxis-dialog__backdrop', 'data-role': 'close'}));

        const $dialog = $('<div/>', {'class': 'aaxis-dialog__dialog'});
        if (this.opts.width) {
            $dialog.css('width', this.opts.width);
        }

        const $head = $('<div/>', {'class': 'aaxis-dialog__head'});
        $head.append($('<h2/>', {'class': 'aaxis-dialog__title', text: this.opts.title}));
        if (this.opts.subtitle) {
            $head.append($('<p/>', {'class': 'aaxis-dialog__subtitle', text: this.opts.subtitle}));
        }
        $head.append($('<button/>', {
            type: 'button', 'class': 'aaxis-dialog__close', 'data-role': 'close',
            title: __('Cancel'), 'aria-label': __('Cancel')
        }).append($('<span/>', {'class': 'fa fa-times', 'aria-hidden': 'true'})));
        $dialog.append($head);

        this.$content = $('<div/>', {'class': 'aaxis-dialog__body'});
        $dialog.append(this.$content);
        $modal.append($dialog);

        this.$modal = $modal;
        $('body').append($modal);
        window.requestAnimationFrame(() => $modal.addClass('is-open'));

        $modal.on('click', '[data-role="close"]', () => this.close());
        $(document).on('keydown.aaxisDialog', (e: any) => {
            if (e.key === 'Escape') {
                this.close();
            }
        });

        return this.$content;
    }

    close(): void {
        if (!this.$modal) {
            return;
        }
        const $m = this.$modal;
        this.$modal = null;
        $(document).off('keydown.aaxisDialog');
        $m.removeClass('is-open');
        window.setTimeout(() => $m.remove(), 180);
        if (this.opts.onClose) {
            this.opts.onClose();
        }
    }
}
