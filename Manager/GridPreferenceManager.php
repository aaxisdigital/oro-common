<?php

declare(strict_types=1);

namespace Aaxis\Bundle\CommonBundle\Manager;

use Aaxis\Bundle\CommonBundle\Entity\GridPreference;
use Doctrine\Persistence\ManagerRegistry;
use Oro\Bundle\SecurityBundle\Authentication\TokenAccessorInterface;
use Oro\Bundle\UserBundle\Entity\User;

/**
 * Loads and stores per-user {@see GridPreference} state for the reusable DataGrid widget.
 */
class GridPreferenceManager
{
    public function __construct(
        private readonly ManagerRegistry $doctrine,
        private readonly TokenAccessorInterface $tokenAccessor,
    ) {
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getState(string $gridKey): ?array
    {
        $user = $this->getUser();
        if ($user === null) {
            return null;
        }

        $pref = $this->doctrine->getRepository(GridPreference::class)
            ->findOneBy(['user' => $user, 'gridKey' => $gridKey]);

        return $pref?->getState();
    }

    /**
     * @param array<string, mixed> $state
     */
    public function saveState(string $gridKey, array $state): void
    {
        $user = $this->getUser();
        if ($user === null) {
            return;
        }

        $em = $this->doctrine->getManagerForClass(GridPreference::class);
        $pref = $this->doctrine->getRepository(GridPreference::class)
            ->findOneBy(['user' => $user, 'gridKey' => $gridKey]);

        if ($pref === null) {
            $pref = new GridPreference();
            $pref->setUser($user);
            $pref->setGridKey($gridKey);
        }
        $pref->setState($state);

        $em->persist($pref);
        $em->flush();
    }

    private function getUser(): ?User
    {
        $user = $this->tokenAccessor->getUser();

        return $user instanceof User ? $user : null;
    }
}
