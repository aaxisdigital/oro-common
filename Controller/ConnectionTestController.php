<?php

declare(strict_types=1);

namespace Aaxis\Bundle\CommonBundle\Controller;

use Aaxis\Bundle\CommonBundle\Connection\ConnectionTestRegistry;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
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
    public function testAction(string $tool): JsonResponse
    {
        // Tests run against the saved configuration only — we deliberately ignore any request-supplied
        // overrides so the endpoint can't be used to probe arbitrary, unsaved hosts/credentials from
        // the UI. Users must save their changes before testing them.
        $result = $this->container->get(ConnectionTestRegistry::class)->test($tool, []);

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
