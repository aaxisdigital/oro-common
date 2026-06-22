<?php

declare(strict_types=1);

namespace Aaxis\Bundle\CommonBundle\Connection;

/**
 * Contract for a single tool's "test connection" check, invoked from its System Configuration page.
 *
 * Implementations live in the bundle that owns the tool and are registered with the
 * "aaxis_common.connection_tester" tag (keyed by {@see getTool()}); the shared
 * {@see ConnectionTestRegistry} dispatches to them. Every returned message must be sanitized so
 * credentials (passwords) are never exposed.
 *
 * @phpstan-type TestResult array{success: bool, message: string, details: array<string, string>}
 */
interface ConnectionTesterInterface
{
    /**
     * The tool key this tester handles (e.g. "database_viewer", "queue_monitor").
     */
    public function getTool(): string;

    /**
     * @param array<string, string> $overrides values entered in the (possibly unsaved) config form
     *
     * @return TestResult
     */
    public function test(array $overrides = []): array;
}
