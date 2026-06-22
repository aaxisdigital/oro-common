<?php

declare(strict_types=1);

namespace Aaxis\Bundle\CommonBundle\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Oro\Bundle\UserBundle\Entity\User;

/**
 * Per-user UI preferences for a reusable DataGrid (column order, hidden columns, page size),
 * keyed by an opaque grid key. Lets a user's layout choices persist across sessions.
 */
#[ORM\Entity]
#[ORM\Table(name: 'aaxis_grid_preference')]
#[ORM\UniqueConstraint(name: 'aaxis_grid_pref_user_grid_uidx', columns: ['user_id', 'grid_key'])]
class GridPreference
{
    #[ORM\Id]
    #[ORM\Column(name: 'id', type: Types::INTEGER)]
    #[ORM\GeneratedValue(strategy: 'AUTO')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'user_id', referencedColumnName: 'id', nullable: true, onDelete: 'CASCADE')]
    private ?User $user = null;

    #[ORM\Column(name: 'grid_key', type: Types::STRING, length: 100)]
    private ?string $gridKey = null;

    #[ORM\Column(name: 'state', type: Types::JSON, nullable: true, options: ['jsonb' => true])]
    private ?array $state = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getUser(): ?User
    {
        return $this->user;
    }

    public function setUser(?User $user): self
    {
        $this->user = $user;

        return $this;
    }

    public function getGridKey(): ?string
    {
        return $this->gridKey;
    }

    public function setGridKey(?string $gridKey): self
    {
        $this->gridKey = $gridKey;

        return $this;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getState(): ?array
    {
        return $this->state;
    }

    /**
     * @param array<string, mixed>|null $state
     */
    public function setState(?array $state): self
    {
        $this->state = $state;

        return $this;
    }
}
