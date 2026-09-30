<?php

declare(strict_types=1);

namespace Aaxis\Bundle\CommonBundle\Tests\Unit\Command;

use Aaxis\Bundle\CommonBundle\Build\TypeScriptCompiler;
use Aaxis\Bundle\CommonBundle\Command\CompileTypeScriptCommand;
use Aaxis\Bundle\CommonBundle\Exception\TypeScriptCompilationException;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\Process\Process;

class CompileTypeScriptCommandTest extends TestCase
{
    private TypeScriptCompiler&MockObject $compiler;
    private CommandTester $tester;

    protected function setUp(): void
    {
        $this->compiler = $this->createMock(TypeScriptCompiler::class);
        $this->compiler->method('getLabel')->willReturn('Widgets');
        $this->tester = new CommandTester(new CompileTypeScriptCommand($this->compiler, 'aaxis:test:compile'));
    }

    public function testCommandIsNamedAndDescribedAfterTheCompilerLabel(): void
    {
        $command = new CompileTypeScriptCommand($this->compiler, 'aaxis:test:compile');

        self::assertSame('aaxis:test:compile', $command->getName());
        self::assertSame('Compiles Widgets TypeScript sources into JavaScript.', $command->getDescription());
    }

    public function testNothingToDoOutsideABuildContext(): void
    {
        $this->compiler->method('shouldCompile')->willReturn(false);
        $this->compiler->expects(self::never())->method('compile');

        self::assertSame(Command::SUCCESS, $this->tester->execute([]));
        self::assertStringContainsString('nothing to compile', $this->tester->getDisplay());
    }

    public function testReportsSuccess(): void
    {
        $this->compiler->method('shouldCompile')->willReturn(true);
        $this->compiler->method('compile')->willReturn($this->processResult(true));

        self::assertSame(Command::SUCCESS, $this->tester->execute([]));
        self::assertStringContainsString('Widgets TypeScript sources compiled.', $this->tester->getDisplay());
    }

    public function testMissingToolchainIsAHardFailure(): void
    {
        $this->compiler->method('shouldCompile')->willReturn(true);
        $this->compiler->method('compile')->willThrowException(new TypeScriptCompilationException('tsc not found'));

        self::assertSame(Command::FAILURE, $this->tester->execute([]));
        self::assertStringContainsString('tsc not found', $this->tester->getDisplay());
    }

    public function testProcessThatCannotStartIsAlsoAFailure(): void
    {
        $this->compiler->method('shouldCompile')->willReturn(true);
        $this->compiler->method('compile')->willThrowException(new \RuntimeException('cannot spawn'));

        self::assertSame(Command::FAILURE, $this->tester->execute([]));
        self::assertStringContainsString('cannot spawn', $this->tester->getDisplay());
    }

    public function testFailedCompilationPrintsTheCompilerOutput(): void
    {
        $this->compiler->method('shouldCompile')->willReturn(true);
        $this->compiler->method('compile')->willReturn($this->processResult(false, 'stdout text', 'stderr text'));

        self::assertSame(Command::FAILURE, $this->tester->execute([]));
        $display = $this->tester->getDisplay();
        self::assertStringContainsString('TypeScript compilation failed.', $display);
        self::assertStringContainsString('stdout text', $display);
        self::assertStringContainsString('stderr text', $display);
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
