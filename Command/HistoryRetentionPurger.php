<?php

declare(strict_types=1);

namespace Aaxis\Bundle\CommonBundle\Command;

use Doctrine\Persistence\ManagerRegistry;

/**
 * Shared retention purge for the Aaxis tools' history tables. Deletes records whose run date is
 * older than the given retention (in days). Reused by each bundle's nightly cleanup command so the
 * delete logic is defined once.
 */
class HistoryRetentionPurger
{
    public function __construct(private readonly ManagerRegistry $doctrine)
    {
    }

    /**
     * Removes records of the given entity whose "runAt" is older than $days. A retention of 0 (or
     * less) keeps every record and deletes nothing.
     *
     * @param class-string $entityClass
     */
    public function purge(string $entityClass, int $days): int
    {
        if ($days <= 0) {
            return 0;
        }

        $threshold = new \DateTime(sprintf('-%d days', $days), new \DateTimeZone('UTC'));
        $em = $this->doctrine->getManagerForClass($entityClass);

        return (int) $em->createQueryBuilder()
            ->delete($entityClass, 'e')
            ->where('e.runAt < :threshold')
            ->setParameter('threshold', $threshold)
            ->getQuery()
            ->execute();
    }
}
