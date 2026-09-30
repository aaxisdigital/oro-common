<?php

declare(strict_types=1);

namespace Aaxis\Bundle\CommonBundle\Tests\Unit\Connection;

use Aaxis\Bundle\CommonBundle\Connection\ConnectionTesterInterface;
use Aaxis\Bundle\CommonBundle\Connection\ConnectionTestRegistry;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\ServiceLocator;

class ConnectionTestRegistryTest extends TestCase
{
    public function testUnknownToolIsReportedAsAFailure(): void
    {
        $registry = new ConnectionTestRegistry(new ServiceLocator([]));

        self::assertSame(
            ['success' => false, 'message' => 'Unknown tool.', 'details' => []],
            $registry->test('nope')
        );
    }

    public function testDispatchesToTheTesterRegisteredForTheTool(): void
    {
        $result = ['success' => true, 'message' => 'OK', 'details' => ['latency' => '3ms']];
        $tester = $this->createMock(ConnectionTesterInterface::class);
        $tester->expects(self::once())->method('test')->with(['host' => 'example'])->willReturn($result);
        $registry = new ConnectionTestRegistry(new ServiceLocator(['redis' => static fn () => $tester]));

        self::assertSame($result, $registry->test('redis', ['host' => 'example']));
    }

    public function testOverridesDefaultToEmpty(): void
    {
        $tester = $this->createMock(ConnectionTesterInterface::class);
        $tester->expects(self::once())->method('test')->with([])
            ->willReturn(['success' => true, 'message' => '', 'details' => []]);
        $registry = new ConnectionTestRegistry(new ServiceLocator(['redis' => static fn () => $tester]));

        self::assertTrue($registry->test('redis')['success']);
    }
}
