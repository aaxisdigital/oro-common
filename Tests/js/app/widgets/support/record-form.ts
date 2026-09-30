import $ from 'jquery';
import {afterEach, beforeEach, vi} from 'vitest';
import RecordFormModal, {type RecordFormOptions} from '../../../../../Resources/js-src/app/widgets/record-form-modal';

const opened: RecordFormModal[] = [];

/** Lets already-settled promise chains (then/catch/finally) run to completion. */
export async function flush(): Promise<void> {
    for (let i = 0; i < 20; i++) {
        await Promise.resolve();
    }
}

/** Opens a modal (closed again automatically after the test); `onSubmit` defaults to a spy. */
export function openForm(options: Partial<RecordFormOptions> & Pick<RecordFormOptions, 'fields'>): RecordFormModal {
    const form = new RecordFormModal({title: 'Edit record', onSubmit: vi.fn(), ...options});
    form.open();
    opened.push(form);

    return form;
}

export const $modal = (): any => $('.aaxis-rfm');

/** The control of a top-level or collection field, by its `data-field` key. */
export const control = (key: string): any => $('.aaxis-rfm [data-field="' + key + '"]').first();

export const fieldError = (key: string): string => control(key).closest('.aaxis-rfm__field').find('[data-role="error"]').text();

export function submit(): void {
    $('.aaxis-rfm [data-role="form"]').trigger('submit');
}

export const alertText = (): string => $('.aaxis-rfm__alert').text();

beforeEach(() => {
    vi.useFakeTimers();
    // The modal fades in on the next frame; run it immediately.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 1;
    });
});

afterEach(() => {
    while (opened.length) {
        opened.pop()!.close();
    }
    $(document).off('.aaxisRecordForm');
    vi.useRealTimers();
});
