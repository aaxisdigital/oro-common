<?php

declare(strict_types=1);

namespace Aaxis\Bundle\CommonBundle\Tests\Unit\Entity;

use Aaxis\Bundle\CommonBundle\Entity\GridPreference;
use Oro\Bundle\UserBundle\Entity\User;
use PHPUnit\Framework\TestCase;

class GridPreferenceTest extends TestCase
{
    public function testNewPreferenceIsEmpty(): void
    {
        $pref = new GridPreference();

        self::assertNull($pref->getId());
        self::assertNull($pref->getUser());
        self::assertNull($pref->getGridKey());
        self::assertNull($pref->getState());
    }

    public function testSettersAreFluentAndValuesRoundTrip(): void
    {
        $user = new User();
        $state = ['columns' => ['a', 'b'], 'pageSize' => 25];

        $pref = new GridPreference();
        $result = $pref->setUser($user)->setGridKey('flows')->setState($state);

        self::assertSame($pref, $result);
        self::assertSame($user, $pref->getUser());
        self::assertSame('flows', $pref->getGridKey());
        self::assertSame($state, $pref->getState());
    }

    public function testValuesCanBeCleared(): void
    {
        $pref = (new GridPreference())->setUser(new User())->setGridKey('x')->setState(['a' => 1]);

        $pref->setUser(null)->setGridKey(null)->setState(null);

        self::assertNull($pref->getUser());
        self::assertNull($pref->getGridKey());
        self::assertNull($pref->getState());
    }
}
