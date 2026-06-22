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

    /**
     * Whether this bundle's TypeScript is meant to be built in the current installation.
     *
     * True when developed in-tree (e.g. under src/) and for our own Aaxis packages installed as
     * Composer dependencies under vendor/aaxisdigital/oro* — those ship only their TypeScript sources
     * and the consuming app builds the JS at asset-build time (we no longer commit it). Any *other*
     * third-party package under vendor/ is left alone: it ships its own pre-built assets and must not
     * be rebuilt here.
     */
    public function shouldCompile(): bool
    {
        $vendorDir = $this->projectDir . '/vendor/';
        if (str_starts_with($this->tsConfigPath, $vendorDir)
            && !str_starts_with($this->tsConfigPath, $vendorDir . 'aaxisdigital/oro')
        ) {
            return false;
        }

        return true;
    }

    /**
     * Whether compilation can actually run right now: a bundle we build (see shouldCompile()) AND the
     * TypeScript toolchain + tsconfig are present. When shouldCompile() is true but this is false, the
     * caller should fail loudly — there is no committed JS to fall back on.
     */
    public function isAvailable(): bool
    {
        return $this->shouldCompile()
            && is_file($this->getTscBinary())
            && is_file($this->tsConfigPath);
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
