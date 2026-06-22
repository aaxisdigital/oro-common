/**
 * Ambient declarations for the third-party / Oro modules consumed by the shared widgets.
 * They are typed as `any` on purpose: the real modules are resolved by Oro's webpack build at
 * bundle time, and shipping full type stubs is out of scope.
 */
declare module 'jquery';
declare module 'underscore';
declare module 'oroui/js/app/components/base/component';
declare module 'oroui/js/messenger';
declare module 'oroui/js/modal';
declare module 'oroform/js/app/views/select2-view';
declare module 'jquery.select2';
declare module 'orotranslation/js/translator';
declare module 'routing';
