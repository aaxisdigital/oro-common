import $ from 'jquery';
import __ from 'orotranslation/js/translator';

export interface DialogOptions {
    title: string;
    subtitle?: string;
    /** Initial dialog width (CSS value). The dialog is resizable. */
    width?: string;
    /** Initial dialog height (CSS value). Omit to size to the content. */
    height?: string;
    /** Adds a drag handle on the header so the user can move the dialog around. */
    movable?: boolean;
    /** Extra class on the dialog body — hook for per-consumer layout. */
    bodyClass?: string;
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
    private $dialog: any = null;
    /** Pointer offset within the dialog while dragging; null when not dragging. */
    private dragFrom: {x: number; y: number} | null = null;

    constructor(options: DialogOptions) {
        this.opts = options;
    }

    /** Builds and shows the dialog; returns the (empty) content element to populate. */
    open(): any {
        const $modal = $('<div/>', {'class': 'aaxis-dialog', role: 'dialog', 'aria-modal': 'true'});
        $modal.append($('<div/>', {'class': 'aaxis-dialog__backdrop', 'data-role': 'close'}));

        const $dialog = $('<div/>', {'class': 'aaxis-dialog__dialog'});
        this.$dialog = $dialog;
        if (this.opts.width) {
            $dialog.css('width', this.opts.width);
        }
        if (this.opts.height) {
            $dialog.css('height', this.opts.height);
        }

        const $head = $('<div/>', {'class': 'aaxis-dialog__head'});
        if (this.opts.movable) {
            $head.addClass('aaxis-dialog__head--movable').attr('data-role', 'drag-handle');
        }
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
        if (this.opts.bodyClass) {
            this.$content.addClass(this.opts.bodyClass);
        }
        $dialog.append(this.$content);
        $modal.append($dialog);

        this.$modal = $modal;
        $('body').append($modal);
        window.requestAnimationFrame(() => $modal.addClass('is-open'));

        $modal.on('click', '[data-role="close"]', () => this.close());
        if (this.opts.movable) {
            // Ignore drags that start on the close button, so it still behaves as a button.
            $modal.on('mousedown', '[data-role="drag-handle"]', (e: any) => {
                if ($(e.target).closest('[data-role="close"]').length === 0) {
                    this.startDrag(e);
                }
            });
        }
        $(document).on('keydown.aaxisDialog', (e: any) => {
            if (e.key === 'Escape') {
                this.close();
            }
        });

        return this.$content;
    }

    // --- Dragging (movable: true) --------------------------------------------

    /**
     * The dialog is normally centred by the flex container; on the first drag it is pinned to its
     * CURRENT on-screen box (fixed left/top, margins dropped) so pointer moves can position it
     * directly without the layout fighting back.
     */
    private startDrag(event: any): void {
        event.preventDefault();
        const rect = this.$dialog.get(0).getBoundingClientRect();
        // Only pinning — the stylesheet's `max-height: 84vh` is deliberately LEFT IN PLACE. Clearing
        // it here would let a requested height (e.g. the playground's 640px) win the moment the
        // header is pressed, growing the dialog past a short viewport with no way to scroll or drag
        // the clipped part back into view.
        this.$dialog.css({
            position: 'fixed',
            left: rect.left + 'px',
            top: rect.top + 'px',
            margin: 0
        });
        this.dragFrom = {x: event.clientX - rect.left, y: event.clientY - rect.top};

        $(document).on('mousemove.aaxisDialogDrag', (e: any) => this.onDrag(e));
        $(document).on('mouseup.aaxisDialogDrag', () => this.endDrag());
    }

    private onDrag(event: any): void {
        if (!this.dragFrom || !this.$dialog) {
            return;
        }
        const width = this.$dialog.outerWidth();
        // Keep a sliver on screen in every direction so the dialog can always be grabbed again
        // (the top clamp keeps the draggable header itself reachable).
        const left = Math.min(Math.max(event.clientX - this.dragFrom.x, 24 - width), window.innerWidth - 24);
        const top = Math.min(Math.max(event.clientY - this.dragFrom.y, 0), window.innerHeight - 24);
        this.$dialog.css({left: left + 'px', top: top + 'px'});
    }

    private endDrag(): void {
        this.dragFrom = null;
        $(document).off('.aaxisDialogDrag');
    }

    close(): void {
        if (!this.$modal) {
            return;
        }
        const $m = this.$modal;
        this.$modal = null;
        this.$dialog = null;
        this.endDrag();
        $(document).off('keydown.aaxisDialog');
        $m.removeClass('is-open');
        window.setTimeout(() => $m.remove(), 180);
        if (this.opts.onClose) {
            this.opts.onClose();
        }
    }
}
