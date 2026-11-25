<?php

declare(strict_types=1);

namespace Aaxis\Bundle\CommonBundle\Tests\Unit\EventListener;

use Aaxis\Bundle\CommonBundle\Build\TypeScriptCompiler;
use Aaxis\Bundle\CommonBundle\EventListener\CompileTypeScriptOnAssetsBuildListener;
use Aaxis\Bundle\CommonBundle\Exception\TypeScriptCompilationException;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\ConsoleEvents;
use Symfony\Component\Console\Event\ConsoleCommandEvent;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\BufferedOutput;
use Symfony\Component\Process\Process;

class CompileTypeScriptOnAssetsBuildListenerTest extends TestCase
{
    private TypeScriptCompiler&MockObject $compiler;
    private CompileTypeScriptOnAssetsBuildListener $listener;
    private BufferedOutput $output;

    protected function setUp(): void
    {
        $this->compiler = $this->createMock(TypeScriptCompiler::class);
        $this->compiler->method('getLabel')->willReturn('Widgets');
        $this->listener = new CompileTypeScriptOnAssetsBuildListener($this->compiler);
        $this->output = new BufferedOutput();
        self::resetVersionBump();
    }

    protected function tearDown(): void
    {
        self::resetVersionBump();
    }

    private static function resetVersionBump(): void
    {
        (new \ReflectionProperty(CompileTypeScriptOnAssetsBuildListener::class, 'assetsVersionBumped'))->setValue(null, false);
    }

    public function testTheBuildRefreshesTheInstalledCopyAndBumpsTheAssetsVersionOncePerProcess(): void
    {
        $this->compiler->method('shouldCompile')->willReturn(true);
        $this->compiler->method('compile')->willReturn($this->processResult(true));
        $this->compiler->expects(self::once())->method('syncInstalledAssets')->willReturn(true);
        $this->compiler->method('getInstalledAssetsDir')->willReturn('/app/public/bundles/widgets');
        $this->compiler->expects(self::once())->method('bumpAssetsVersion')->willReturn('cafe1234');

        $this->listener->onConsoleCommand($this->event('oro:assets:build'));

        $display = $this->output->fetch();
        self::assertStringContainsString('[Widgets] Refreshed /app/public/bundles/widgets from the bundle.', $display);
        self::assertStringContainsString('[Widgets] Assets version set to cafe1234', $display);

        // Another Aaxis bundle's listener in the same build: its copy is refreshed, no second bump.
        $other = $this->createMock(TypeScriptCompiler::class);
        $other->method('getLabel')->willReturn('Others');
        $other->method('shouldCompile')->willReturn(true);
        $other->method('compile')->willReturn($this->processResult(true));
        $other->expects(self::once())->method('syncInstalledAssets')->willReturn(false);
        $other->expects(self::never())->method('bumpAssetsVersion');
        (new CompileTypeScriptOnAssetsBuildListener($other))->onConsoleCommand($this->event('oro:assets:build'));

        $display = $this->output->fetch();
        self::assertStringNotContainsString('Refreshed', $display, 'a symlinked install needs no refresh');
        self::assertStringNotContainsString('Assets version', $display);
    }

    public function testInstallNeitherRefreshesNorBumps(): void
    {
        $this->compiler->method('shouldCompile')->willReturn(true);
        $this->compiler->method('compile')->willReturn($this->processResult(true));
        $this->compiler->expects(self::never())->method('syncInstalledAssets');
        $this->compiler->expects(self::never())->method('bumpAssetsVersion');

        $this->listener->onConsoleCommand($this->event('oro:assets:install'));
    }

    public function testAFailedCompilationNeitherRefreshesNorBumps(): void
    {
        $this->compiler->method('shouldCompile')->willReturn(true);
        $this->compiler->method('compile')->willReturn($this->processResult(false));
        $this->compiler->expects(self::never())->method('syncInstalledAssets');
        $this->compiler->expects(self::never())->method('bumpAssetsVersion');
        $this->expectException(TypeScriptCompilationException::class);

        $this->listener->onConsoleCommand($this->event('oro:assets:build'));
    }

    public function testSubscribesToConsoleCommandEvent(): void
    {
        self::assertSame(
            [ConsoleEvents::COMMAND => 'onConsoleCommand'],
            CompileTypeScriptOnAssetsBuildListener::getSubscribedEvents()
        );
    }

    public function testEventWithoutACommandIsIgnored(): void
    {
        $this->compiler->expects(self::never())->method('compile');

        $this->listener->onConsoleCommand($this->event(null));

        self::assertSame('', $this->output->fetch());
    }

    public function testUnrelatedCommandIsIgnored(): void
    {
        $this->compiler->expects(self::never())->method('compile');

        $this->listener->onConsoleCommand($this->event('cache:clear'));

        self::assertSame('', $this->output->fetch());
    }

    /**
     * @dataProvider triggerCommandProvider
     */
    public function testAssetCommandsTriggerCompilation(string $commandName): void
    {
        $this->compiler->method('shouldCompile')->willReturn(true);
        $this->compiler->expects(self::once())->method('compile')->willReturn($this->processResult(true));

        $this->listener->onConsoleCommand($this->event($commandName));

        $display = $this->output->fetch();
        self::assertStringContainsString('[Widgets] Compiling TypeScript sources...', $display);
        self::assertStringContainsString('[Widgets] TypeScript compiled.', $display);
    }

    /**
     * @return iterable<string, array{string}>
     */
    public static function triggerCommandProvider(): iterable
    {
        yield 'assets build' => ['oro:assets:build'];
        yield 'assets install' => ['oro:assets:install'];
    }

    public function testForeignVendorPackageIsLeftAlone(): void
    {
        $this->compiler->method('shouldCompile')->willReturn(false);
        $this->compiler->expects(self::never())->method('compile');

        $this->listener->onConsoleCommand($this->event('oro:assets:build'));

        self::assertSame('', $this->output->fetch());
    }

    public function testMissingToolchainAbortsTheAssetBuild(): void
    {
        $this->compiler->method('shouldCompile')->willReturn(true);
        $previous = new TypeScriptCompilationException('tsc not found');
        $this->compiler->method('compile')->willThrowException($previous);

        try {
            $this->listener->onConsoleCommand($this->event('oro:assets:build'));
            self::fail('The asset build should have been aborted.');
        } catch (TypeScriptCompilationException $e) {
            self::assertStringContainsString('[Widgets] Cannot compile TypeScript', $e->getMessage());
            self::assertStringContainsString('tsc not found', $e->getMessage());
            self::assertSame($previous, $e->getPrevious());
        }
    }

    public function testFailedCompilationPrintsOutputAndAbortsTheAssetBuild(): void
    {
        $this->compiler->method('shouldCompile')->willReturn(true);
        $this->compiler->method('compile')->willReturn($this->processResult(false, 'out-text', 'err-text'));

        try {
            $this->listener->onConsoleCommand($this->event('oro:assets:build'));
            self::fail('The asset build should have been aborted.');
        } catch (TypeScriptCompilationException $e) {
            self::assertStringContainsString('compilation failed; aborting asset build', $e->getMessage());
        }

        $display = $this->output->fetch();
        self::assertStringContainsString('[Widgets] TypeScript compilation failed:', $display);
        self::assertStringContainsString('out-texterr-text', $display);
    }

    private function event(?string $commandName): ConsoleCommandEvent
    {
        $command = $commandName === null ? null : new Command($commandName);

        return new ConsoleCommandEvent($command, new ArrayInput([]), $this->output);
    }

    private function processResult(bool $successful, string $output = '', string $errorOutput = ''): Process
    {
        $process = $this->createMock(Process::class);
        $process->method('isSuccessful')->willReturn($successful);
        $process->method('getOutput')->willReturn($output);
        $process->method('getErrorOutput')->willReturn($errorOutput);

        return $process;
    }
}
