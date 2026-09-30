<?php

declare(strict_types=1);

namespace Aaxis\Bundle\CommonBundle\Tests\Unit\DependencyInjection;

use Aaxis\Bundle\CommonBundle\Build\TypeScriptCompiler;
use Aaxis\Bundle\CommonBundle\Command\CompileTypeScriptCommand;
use Aaxis\Bundle\CommonBundle\Connection\ConnectionTestRegistry;
use Aaxis\Bundle\CommonBundle\DependencyInjection\AaxisCommonExtension;
use Aaxis\Bundle\CommonBundle\Manager\GridPreferenceManager;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\ContainerBuilder;

class AaxisCommonExtensionTest extends TestCase
{
    private ContainerBuilder $container;

    protected function setUp(): void
    {
        $this->container = new ContainerBuilder();
        (new AaxisCommonExtension())->load([], $this->container);
    }

    public function testAliasMatchesTheSettingKeyPrefix(): void
    {
        self::assertSame('aaxis_common', (new AaxisCommonExtension())->getAlias());
    }

    public function testExposesTheBundleDirectoryForTheTypeScriptBuild(): void
    {
        $dir = $this->container->getParameter('aaxis_common.bundle_dir');

        self::assertIsString($dir);
        self::assertFileExists($dir . '/Resources/js-src/tsconfig.json');
    }

    /**
     * @dataProvider serviceProvider
     */
    public function testRegistersTheSharedServices(string $id, ?string $explicitClass): void
    {
        self::assertTrue($this->container->hasDefinition($id), $id);
        // Services keyed by their class name carry no explicit class; the others must point at the right one.
        self::assertSame($explicitClass, $this->container->getDefinition($id)->getClass());
    }

    /**
     * @return iterable<string, array{string, class-string|null}>
     */
    public static function serviceProvider(): iterable
    {
        yield 'grid preference manager' => [GridPreferenceManager::class, null];
        yield 'connection test registry' => [ConnectionTestRegistry::class, null];
        yield 'typescript compiler' => ['aaxis_common.typescript_compiler', TypeScriptCompiler::class];
        yield 'typescript command' => ['aaxis_common.typescript_compile_command', CompileTypeScriptCommand::class];
    }

    public function testPublicAliasesAreExposedForConsumingBundles(): void
    {
        foreach (['aaxis_common.grid_preference_manager', 'aaxis_common.connection_test_registry',
            'aaxis_common.history_retention_purger'] as $alias) {
            self::assertTrue($this->container->getAlias($alias)->isPublic(), $alias);
        }
    }
}
