<?php

declare(strict_types=1);

namespace Aaxis\Bundle\CommonBundle\Migrations\Data\ORM;

use Doctrine\Persistence\ObjectManager;
use Oro\Bundle\DistributionBundle\Handler\ApplicationState;
use Oro\Bundle\SecurityBundle\Migrations\Data\ORM\AbstractUpdatePermissions;
use Oro\Bundle\UserBundle\Entity\User;

/**
 * Grants the shared "aaxis_common" capability (grid-preference endpoints) to the Administrator role.
 */
class LoadAaxisCommonAdminPermissions extends AbstractUpdatePermissions
{
    #[\Override]
    public function load(ObjectManager $manager): void
    {
        if (!$this->container->get(ApplicationState::class)->isInstalled()) {
            return;
        }

        $aclManager = $this->getAclManager();
        if (!$aclManager->isAclEnabled()) {
            return;
        }

        $this->enableActions(
            $aclManager,
            $this->getRole($manager, User::ROLE_ADMINISTRATOR),
            ['aaxis_common']
        );

        $aclManager->flush();
    }
}
