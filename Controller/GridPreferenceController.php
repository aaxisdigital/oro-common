<?php

declare(strict_types=1);

namespace Aaxis\Bundle\CommonBundle\Controller;

use Aaxis\Bundle\CommonBundle\Manager\GridPreferenceManager;
use Oro\Bundle\SecurityBundle\Attribute\AclAncestor;
use Oro\Bundle\SecurityBundle\Attribute\CsrfProtection;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Stores per-user DataGrid layout preferences (column order, hidden columns, page size).
 */
class GridPreferenceController extends AbstractController
{
    #[Route(
        path: '/grid-preferences/{gridKey}',
        name: 'aaxis_common_grid_preference_get',
        requirements: ['gridKey' => '[A-Za-z0-9_\-]+'],
        options: ['expose' => true],
        methods: ['GET']
    )]
    #[AclAncestor('aaxis_common')]
    public function getAction(string $gridKey): JsonResponse
    {
        return new JsonResponse([
            'state' => $this->container->get(GridPreferenceManager::class)->getState($gridKey),
        ]);
    }

    #[Route(
        path: '/grid-preferences/{gridKey}',
        name: 'aaxis_common_grid_preference_save',
        requirements: ['gridKey' => '[A-Za-z0-9_\-]+'],
        options: ['expose' => true],
        methods: ['PUT', 'POST']
    )]
    #[AclAncestor('aaxis_common')]
    #[CsrfProtection]
    public function saveAction(string $gridKey, Request $request): JsonResponse
    {
        $payload = json_decode($request->getContent(), true);
        if (!\is_array($payload)) {
            return new JsonResponse(['success' => false, 'message' => 'Invalid payload.'], 400);
        }

        $state = \is_array($payload['state'] ?? null) ? $payload['state'] : [];
        $this->container->get(GridPreferenceManager::class)->saveState($gridKey, $state);

        return new JsonResponse(['success' => true]);
    }

    #[\Override]
    public static function getSubscribedServices(): array
    {
        return array_merge(parent::getSubscribedServices(), [
            GridPreferenceManager::class,
        ]);
    }
}
