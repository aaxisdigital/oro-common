<?php

declare(strict_types=1);

namespace Aaxis\Bundle\CommonBundle\DependencyInjection;

use Symfony\Component\Config\FileLocator;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Loader;
use Symfony\Component\HttpKernel\DependencyInjection\Extension;

/**
 * Loads the bundle's service definitions. The alias resolves to "aaxis_common".
 */
class AaxisCommonExtension extends Extension
{
    #[\Override]
    public function load(array $configs, ContainerBuilder $container): void
    {
        // Absolute path to this bundle's root, resolved wherever the package is installed
        // (src/… in a monorepo, vendor/aaxisdigital/oro-common when pulled via Composer).
        // Used to point the TypeScript build at this bundle's own tsconfig.
        $container->setParameter('aaxis_common.bundle_dir', \dirname(__DIR__));

        $loader = new Loader\YamlFileLoader($container, new FileLocator(__DIR__ . '/../Resources/config'));
        $loader->load('services.yml');
        $loader->load('controllers.yml');
    }
}
