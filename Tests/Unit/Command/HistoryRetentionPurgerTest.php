<?php

declare(strict_types=1);

namespace Aaxis\Bundle\CommonBundle\Tests\Unit\Command;

use Aaxis\Bundle\CommonBundle\Command\HistoryRetentionPurger;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Query;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;
use PHPUnit\Framework\TestCase;

class HistoryRetentionPurgerTest extends TestCase
{
    /**
     * @dataProvider nonPositiveRetentionProvider
     */
    public function testNonPositiveRetentionKeepsEverything(int $days): void
    {
        $doctrine = $this->createMock(ManagerRegistry::class);
        $doctrine->expects(self::never())->method('getManagerForClass');

        self::assertSame(0, (new HistoryRetentionPurger($doctrine))->purge(\stdClass::class, $days));
    }

    /**
     * @return iterable<string, array{int}>
     */
    public static function nonPositiveRetentionProvider(): iterable
    {
        yield 'zero' => [0];
        yield 'negative' => [-5];
    }

    public function testDeletesRecordsOlderThanTheRetentionAndReturnsTheCount(): void
    {
        $query = $this->createMock(Query::class);
        $query->expects(self::once())->method('execute')->willReturn('7');

        $builder = $this->createMock(QueryBuilder::class);
        $builder->expects(self::once())->method('delete')->with(\stdClass::class, 'e')->willReturnSelf();
        $builder->expects(self::once())->method('where')->with('e.runAt < :threshold')->willReturnSelf();
        $builder->expects(self::once())->method('setParameter')->with(
            'threshold',
            self::callback(static function (mixed $threshold): bool {
                // 30 days ago, in UTC, give or take the seconds the test itself takes.
                $expected = new \DateTimeImmutable('-30 days', new \DateTimeZone('UTC'));

                return $threshold instanceof \DateTime
                    && $threshold->getTimezone()->getName() === 'UTC'
                    && abs($threshold->getTimestamp() - $expected->getTimestamp()) < 5;
            })
        )->willReturnSelf();
        $builder->method('getQuery')->willReturn($query);

        $em = $this->createMock(EntityManagerInterface::class);
        $em->method('createQueryBuilder')->willReturn($builder);
        $doctrine = $this->createMock(ManagerRegistry::class);
        $doctrine->expects(self::once())->method('getManagerForClass')->with(\stdClass::class)->willReturn($em);

        self::assertSame(7, (new HistoryRetentionPurger($doctrine))->purge(\stdClass::class, 30));
    }
}
