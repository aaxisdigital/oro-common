<?php

declare(strict_types=1);

namespace Aaxis\Bundle\CommonBundle\Tests\Unit\Manager;

use Aaxis\Bundle\CommonBundle\Entity\GridPreference;
use Aaxis\Bundle\CommonBundle\Manager\GridPreferenceManager;
use Doctrine\Persistence\ManagerRegistry;
use Doctrine\Persistence\ObjectManager;
use Doctrine\Persistence\ObjectRepository;
use Oro\Bundle\SecurityBundle\Authentication\TokenAccessorInterface;
use Oro\Bundle\UserBundle\Entity\User;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Security\Core\User\InMemoryUser;

class GridPreferenceManagerTest extends TestCase
{
    private ManagerRegistry&MockObject $doctrine;
    private TokenAccessorInterface&MockObject $tokenAccessor;
    private ObjectRepository&MockObject $repository;
    private GridPreferenceManager $manager;

    protected function setUp(): void
    {
        $this->doctrine = $this->createMock(ManagerRegistry::class);
        $this->tokenAccessor = $this->createMock(TokenAccessorInterface::class);
        $this->repository = $this->createMock(ObjectRepository::class);
        $this->doctrine->method('getRepository')->with(GridPreference::class)->willReturn($this->repository);
        $this->manager = new GridPreferenceManager($this->doctrine, $this->tokenAccessor);
    }

    public function testAnonymousUserHasNoState(): void
    {
        $this->tokenAccessor->method('getUser')->willReturn(null);
        $this->repository->expects(self::never())->method('findOneBy');

        self::assertNull($this->manager->getState('flows'));
    }

    public function testNonOroUserHasNoState(): void
    {
        $this->tokenAccessor->method('getUser')->willReturn(new InMemoryUser('api', null));
        $this->repository->expects(self::never())->method('findOneBy');

        self::assertNull($this->manager->getState('flows'));
    }

    public function testReturnsTheStoredState(): void
    {
        $user = new User();
        $this->tokenAccessor->method('getUser')->willReturn($user);
        $this->repository->expects(self::once())->method('findOneBy')
            ->with(['user' => $user, 'gridKey' => 'flows'])
            ->willReturn((new GridPreference())->setState(['pageSize' => 50]));

        self::assertSame(['pageSize' => 50], $this->manager->getState('flows'));
    }

    public function testNoStoredPreferenceMeansNoState(): void
    {
        $this->tokenAccessor->method('getUser')->willReturn(new User());
        $this->repository->method('findOneBy')->willReturn(null);

        self::assertNull($this->manager->getState('flows'));
    }

    public function testSavingWithoutAUserIsANoOp(): void
    {
        $this->tokenAccessor->method('getUser')->willReturn(null);
        $this->doctrine->expects(self::never())->method('getManagerForClass');

        $this->manager->saveState('flows', ['pageSize' => 10]);
    }

    public function testSaveCreatesAPreferenceForFirstTimeUsers(): void
    {
        $user = new User();
        $this->tokenAccessor->method('getUser')->willReturn($user);
        $this->repository->method('findOneBy')->willReturn(null);

        $em = $this->createMock(ObjectManager::class);
        $this->doctrine->method('getManagerForClass')->with(GridPreference::class)->willReturn($em);
        $em->expects(self::once())->method('persist')->with(self::callback(
            static fn (GridPreference $pref): bool => $pref->getUser() === $user
                && $pref->getGridKey() === 'flows'
                && $pref->getState() === ['pageSize' => 10]
        ));
        $em->expects(self::once())->method('flush');

        $this->manager->saveState('flows', ['pageSize' => 10]);
    }

    public function testSaveUpdatesTheExistingPreferenceInPlace(): void
    {
        $existing = (new GridPreference())->setGridKey('flows')->setState(['pageSize' => 5]);
        $this->tokenAccessor->method('getUser')->willReturn(new User());
        $this->repository->method('findOneBy')->willReturn($existing);

        $em = $this->createMock(ObjectManager::class);
        $this->doctrine->method('getManagerForClass')->willReturn($em);
        $em->expects(self::once())->method('persist')->with($existing);
        $em->expects(self::once())->method('flush');

        $this->manager->saveState('flows', ['pageSize' => 100]);

        self::assertSame(['pageSize' => 100], $existing->getState());
    }
}
