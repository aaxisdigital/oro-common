<?php

declare(strict_types=1);

namespace Aaxis\Bundle\CommonBundle\Tests\Unit\Build;

use Aaxis\Bundle\CommonBundle\Build\TypeScriptCompiler;
use Aaxis\Bundle\CommonBundle\Exception\TypeScriptCompilationException;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use Symfony\Component\Filesystem\Filesystem;

class TypeScriptCompilerTest extends TestCase
{
    private string $projectDir;

    protected function setUp(): void
    {
        $this->projectDir = sys_get_temp_dir() . '/aaxis_tsc_' . bin2hex(random_bytes(4));
        (new Filesystem())->mkdir($this->projectDir);
    }

    protected function tearDown(): void
    {
        (new Filesystem())->remove($this->projectDir);
    }

    /**
     * @dataProvider shouldCompileProvider
     */
    public function testShouldCompile(string $tsConfigPath, bool $expected): void
    {
        $compiler = $this->createCompiler(sprintf($tsConfigPath, $this->projectDir));

        self::assertSame($expected, $compiler->shouldCompile());
    }

    /**
     * @return iterable<string, array{string, bool}>
     */
    public static function shouldCompileProvider(): iterable
    {
        yield 'in-tree bundle' => ['%s/src/Foo/Resources/js-src/tsconfig.json', true];
        yield 'aaxis package in vendor' => ['%s/vendor/aaxisdigital/oro-common/Resources/js-src/tsconfig.json', true];
        yield 'foreign package in vendor' => ['%s/vendor/acme/thing/tsconfig.json', false];
        yield 'aaxis-prefixed sibling is not ours' => ['%s/vendor/aaxisdigital/other/tsconfig.json', false];
    }

    public function testGettersExposeConstructorArguments(): void
    {
        $compiler = $this->createCompiler('/some/tsconfig.json', 'MyLabel');

        self::assertSame('/some/tsconfig.json', $compiler->getTsConfigPath());
        self::assertSame('MyLabel', $compiler->getLabel());
    }

    public function testIsAvailableNeedsToolchainAndTsConfig(): void
    {
        $tsConfig = $this->projectDir . '/tsconfig.json';
        $compiler = $this->createCompiler($tsConfig);

        self::assertFalse($compiler->isAvailable(), 'nothing installed yet');

        $this->installFakeTsc(0);
        self::assertFalse($compiler->isAvailable(), 'tsc present but no tsconfig');

        file_put_contents($tsConfig, '{}');
        self::assertTrue($compiler->isAvailable());
    }

    public function testIsAvailableIsFalseForForeignVendorPackage(): void
    {
        $tsConfig = $this->projectDir . '/vendor/acme/thing/tsconfig.json';
        (new Filesystem())->dumpFile($tsConfig, '{}');
        $this->installFakeTsc(0);

        self::assertFalse($this->createCompiler($tsConfig)->isAvailable());
    }

    public function testCompileFailsWhenTscIsMissing(): void
    {
        $compiler = $this->createCompiler($this->projectDir . '/tsconfig.json');

        $this->expectException(TypeScriptCompilationException::class);
        $this->expectExceptionMessage('TypeScript compiler not found');

        $compiler->compile();
    }

    public function testCompileFailsWhenTsConfigIsMissing(): void
    {
        $this->installFakeTsc(0);
        $compiler = $this->createCompiler($this->projectDir . '/tsconfig.json');

        $this->expectException(TypeScriptCompilationException::class);
        $this->expectExceptionMessage('tsconfig not found');

        $compiler->compile();
    }

    public function testCompileReturnsSuccessfulProcessWithoutLogging(): void
    {
        $tsConfig = $this->projectDir . '/tsconfig.json';
        file_put_contents($tsConfig, '{}');
        $this->installFakeTsc(0, 'compiled ok');

        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects(self::never())->method('error');

        $process = (new TypeScriptCompiler($this->projectDir, $logger, $tsConfig, 'Label'))->compile();

        self::assertTrue($process->isSuccessful());
        self::assertSame('compiled ok', trim($process->getOutput()));
    }

    public function testCompileLogsAFailedRunAndStillReturnsTheProcess(): void
    {
        $tsConfig = $this->projectDir . '/tsconfig.json';
        file_put_contents($tsConfig, '{}');
        $this->installFakeTsc(2, 'TS2304: cannot find name');

        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects(self::once())
            ->method('error')
            ->with(
                'Label TypeScript compilation failed.',
                self::callback(static fn (array $context): bool => str_contains($context['output'], 'TS2304')
                    && \array_key_exists('error_output', $context))
            );

        $process = (new TypeScriptCompiler($this->projectDir, $logger, $tsConfig, 'Label'))->compile();

        self::assertFalse($process->isSuccessful());
    }

    public function testAssetPathsFollowTheBundleLayoutAndSymfonysNaming(): void
    {
        $tsConfig = $this->projectDir . '/vendor/aaxisdigital/oro-ontology/Resources/js-src/tsconfig.json';

        $compiler = $this->createCompiler($tsConfig, 'AaxisOntologyBundle');
        self::assertSame($this->projectDir . '/vendor/aaxisdigital/oro-ontology/Resources/public', $compiler->getBundlePublicDir());
        self::assertSame($this->projectDir . '/public/bundles/aaxisontology', $compiler->getInstalledAssetsDir());

        $named = new TypeScriptCompiler($this->projectDir, $this->createMock(LoggerInterface::class), $tsConfig, 'Ontology', 'custom');
        self::assertSame($this->projectDir . '/public/bundles/custom', $named->getInstalledAssetsDir());
    }

    public function testSyncMakesTheInstalledCopyIdenticalToTheBundle(): void
    {
        $fs = new Filesystem();
        $compiler = $this->createCompiler($this->projectDir . '/bundle/Resources/js-src/tsconfig.json', 'AcmeBundle');
        $source = $this->projectDir . '/bundle/Resources/public';
        $target = $this->projectDir . '/public/bundles/acme';
        $fs->dumpFile($source . '/js/app/new.js', 'new');
        $fs->dumpFile($source . '/js/app/changed.js', 'v2');
        $fs->dumpFile($source . '/css/style.scss', 'a {}');
        $fs->dumpFile($target . '/js/app/changed.js', 'v1');
        $fs->dumpFile($target . '/js/app/removed.js', 'gone');

        self::assertTrue($compiler->syncInstalledAssets());

        self::assertSame('new', file_get_contents($target . '/js/app/new.js'));
        self::assertSame('v2', file_get_contents($target . '/js/app/changed.js'));
        self::assertSame('a {}', file_get_contents($target . '/css/style.scss'));
        self::assertFileDoesNotExist($target . '/js/app/removed.js');
    }

    public function testSyncCreatesAMissingCopy(): void
    {
        $compiler = $this->createCompiler($this->projectDir . '/bundle/Resources/js-src/tsconfig.json', 'AcmeBundle');
        (new Filesystem())->dumpFile($this->projectDir . '/bundle/Resources/public/js/a.js', 'a');

        self::assertTrue($compiler->syncInstalledAssets());
        self::assertFileExists($this->projectDir . '/public/bundles/acme/js/a.js');
    }

    public function testSyncLeavesASymlinkedInstallAndAMissingSourceAlone(): void
    {
        $fs = new Filesystem();
        $compiler = $this->createCompiler($this->projectDir . '/bundle/Resources/js-src/tsconfig.json', 'AcmeBundle');
        self::assertFalse($compiler->syncInstalledAssets(), 'no Resources/public');

        $fs->dumpFile($this->projectDir . '/bundle/Resources/public/js/a.js', 'a');
        $fs->mkdir($this->projectDir . '/public/bundles');
        $fs->symlink($this->projectDir . '/bundle/Resources/public', $this->projectDir . '/public/bundles/acme');

        self::assertFalse($compiler->syncInstalledAssets());
        self::assertTrue(is_link($this->projectDir . '/public/bundles/acme'));
    }

    public function testBumpingWritesANewAssetsVersionEachTime(): void
    {
        $compiler = $this->createCompiler($this->projectDir . '/tsconfig.json');
        $file = $this->projectDir . '/' . TypeScriptCompiler::ASSETS_VERSION_FILE;

        $first = $compiler->bumpAssetsVersion();
        self::assertMatchesRegularExpression('/^[0-9a-f]{8}$/', $first);
        self::assertSame($first, file_get_contents($file));

        $second = $compiler->bumpAssetsVersion();
        self::assertNotSame($first, $second);
        self::assertSame($second, file_get_contents($file));
    }

    private function createCompiler(string $tsConfigPath, string $label = 'Label'): TypeScriptCompiler
    {
        return new TypeScriptCompiler(
            $this->projectDir,
            $this->createMock(LoggerInterface::class),
            $tsConfigPath,
            $label
        );
    }

    /**
     * Drops a stand-in for node_modules/.bin/tsc that prints $stdout and exits with $exitCode.
     */
    private function installFakeTsc(int $exitCode, string $stdout = ''): void
    {
        $tsc = $this->projectDir . '/node_modules/.bin/tsc';
        (new Filesystem())->dumpFile($tsc, sprintf("#!/bin/sh\necho '%s'\nexit %d\n", $stdout, $exitCode));
        chmod($tsc, 0755);
    }
}
