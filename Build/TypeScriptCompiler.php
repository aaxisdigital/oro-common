<?php

declare(strict_types=1);

namespace Aaxis\Bundle\CommonBundle\Build;

use Psr\Log\LoggerInterface;
use Symfony\Component\Process\Process;

/**
 * Transpiles a bundle's TypeScript sources into ES modules using the project's local TypeScript
 * compiler. The emitted JS keeps its ES `import`/`export` statements so the regular Oro webpack
 * build resolves dependencies (CodeMirror, oroui modules, ...) afterwards.
 *
 * This is shared infrastructure: each consuming Aaxis bundle wires one instance with the path to
 * its own `tsconfig.json` and a human-readable label used in log/console output.
 */
class TypeScriptCompiler
{
    public function __construct(
        private readonly string $projectDir,
        private readonly LoggerInterface $logger,
        private readonly string $tsConfigPath,
        private readonly string $label,
    ) {
    }

    public function isAvailable(): bool
    {
        // Don't recompile a bundle that the host application pulled in as a Composer dependency:
        // installed packages under vendor/ ship their pre-compiled JS and their TypeScript sources
        // are not meant to be rebuilt by the consuming app. Recompilation only applies when a bundle
        // is being developed in-tree (e.g. under src/).
        if (str_starts_with($this->tsConfigPath, $this->projectDir . '/vendor/')) {
            return false;
        }

        return is_file($this->getTscBinary()) && is_file($this->tsConfigPath);
    }

    public function getTsConfigPath(): string
    {
        return $this->tsConfigPath;
    }

    public function getLabel(): string
    {
        return $this->label;
    }

    private function getTscBinary(): string
    {
        return $this->projectDir . '/node_modules/.bin/tsc';
    }

    /**
     * Runs the TypeScript compiler.
     *
     * @throws \RuntimeException when TypeScript is not installed or the tsconfig is missing
     */
    public function compile(): Process
    {
        if (!is_file($this->getTscBinary())) {
            throw new \RuntimeException(sprintf(
                'TypeScript compiler not found at "%s". Install it with "pnpm add -D typescript".',
                $this->getTscBinary()
            ));
        }
        if (!is_file($this->tsConfigPath)) {
            throw new \RuntimeException(sprintf('tsconfig not found at "%s".', $this->tsConfigPath));
        }

        $process = new Process(
            [$this->getTscBinary(), '--project', $this->tsConfigPath],
            $this->projectDir
        );
        $process->setTimeout(300.0);
        $process->run();

        if (!$process->isSuccessful()) {
            $this->logger->error(sprintf('%s TypeScript compilation failed.', $this->label), [
                'output' => $process->getOutput(),
                'error_output' => $process->getErrorOutput(),
            ]);
        }

        return $process;
    }
}
