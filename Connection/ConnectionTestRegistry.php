<?php

declare(strict_types=1);

namespace Aaxis\Bundle\CommonBundle\Connection;

use Psr\Container\ContainerInterface;

/**
 * Dispatches a "test connection" request to the {@see ConnectionTesterInterface} that handles the
 * given tool. Testers are contributed by the feature bundles via the "aaxis_common.connection_tester"
 * tag and looked up here by their tool key.
 *
 * @phpstan-import-type TestResult from ConnectionTesterInterface
 */
class ConnectionTestRegistry
{
    public function __construct(private readonly ContainerInterface $testers)
    {
    }

    /**
     * @param array<string, string> $overrides values entered in the config form (unsaved)
     *
     * @return TestResult
     */
    public function test(string $tool, array $overrides = []): array
    {
        if (!$this->testers->has($tool)) {
            return ['success' => false, 'message' => 'Unknown tool.', 'details' => []];
        }

        /** @var ConnectionTesterInterface $tester */
        $tester = $this->testers->get($tool);

        return $tester->test($overrides);
    }
}
