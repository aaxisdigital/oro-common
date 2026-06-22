<?php

declare(strict_types=1);

namespace Aaxis\Bundle\CommonBundle\Controller;

use Aaxis\Bundle\CommonBundle\Connection\ConnectionTestRegistry;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Runs the "test connection" checks invoked from the System Configuration pages of any Aaxis tool.
 *
 * The concrete checks are provided by the feature bundles (see ConnectionTesterInterface) and
 * resolved by tool key through the shared {@see ConnectionTestRegistry}.
 */
class ConnectionTestController extends AbstractController
{
    #[Route(
        path: '/connection-test/{tool}',
        name: 'aaxis_common_connection_test',
        requirements: ['tool' => '[a-z_]+'],
        options: ['expose' => true],
        methods: ['GET']
    )]
    public function testAction(string $tool, Request $request): JsonResponse
    {
        // Values entered in the (possibly unsaved) config form, so the test runs in edit mode.
        $overrides = $request->query->all('overrides');
        $result = $this->container->get(ConnectionTestRegistry::class)->test($tool, $overrides);

        return new JsonResponse($result);
    }

    #[\Override]
    public static function getSubscribedServices(): array
    {
        return array_merge(parent::getSubscribedServices(), [
            ConnectionTestRegistry::class,
        ]);
    }
}
