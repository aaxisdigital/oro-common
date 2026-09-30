<?php

declare(strict_types=1);

namespace Aaxis\Bundle\CommonBundle\Tests\Unit\Controller;

use Aaxis\Bundle\CommonBundle\Connection\ConnectionTestRegistry;
use Aaxis\Bundle\CommonBundle\Controller\ConnectionTestController;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\Container;

class ConnectionTestControllerTest extends TestCase
{
    public function testRunsTheCheckAgainstSavedConfigurationOnly(): void
    {
        $result = ['success' => true, 'message' => 'Connected', 'details' => ['version' => '7']];
        $registry = $this->createMock(ConnectionTestRegistry::class);
        // The endpoint must never forward request-supplied overrides to the registry.
        $registry->expects(self::once())->method('test')->with('redis', [])->willReturn($result);

        $container = new Container();
        $container->set(ConnectionTestRegistry::class, $registry);
        $controller = new ConnectionTestController();
        $controller->setContainer($container);

        $response = $controller->testAction('redis');

        self::assertSame(200, $response->getStatusCode());
        self::assertSame($result, json_decode((string) $response->getContent(), true));
    }

    public function testDeclaresTheRegistryAsASubscribedService(): void
    {
        self::assertContains(ConnectionTestRegistry::class, ConnectionTestController::getSubscribedServices());
    }
}
