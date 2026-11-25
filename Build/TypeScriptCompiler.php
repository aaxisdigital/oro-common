<?php

declare(strict_types=1);

namespace Aaxis\Bundle\CommonBundle\Build;

use Aaxis\Bundle\CommonBundle\Exception\TypeScriptCompilationException;
use Psr\Log\LoggerInterface;
use Symfony\Component\Filesystem\Filesystem;
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
    /** The asset version file Oro's BuildVersionStrategy and webpack config read (`?v=` on every asset URL). */
    public const string ASSETS_VERSION_FILE = 'public/build/build_version.txt';

    /**
     * @param string|null $assetsDirName the bundle's folder under public/bundles; by default derived
     *                                   from the label the way Symfony names it (AaxisOntologyBundle
     *                                   → aaxisontology)
     */
    public function __construct(
        private readonly string $projectDir,
        private readonly LoggerInterface $logger,
        private readonly string $tsConfigPath,
        private readonly string $label,
        private readonly ?string $assetsDirName = null,
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

    /** The bundle's own public assets (`Resources/public`, home of the emitted `js/`). */
    public function getBundlePublicDir(): string
    {
        return \dirname($this->tsConfigPath, 2) . '/public';
    }

    /** Where `oro:assets:install` puts this bundle's assets — what webpack actually reads. */
    public function getInstalledAssetsDir(): string
    {
        $name = $this->assetsDirName ?? strtolower((string) preg_replace('/Bundle$/', '', $this->label));

        return $this->projectDir . '/public/bundles/' . $name;
    }

    /**
     * Makes the installed copy (public/bundles/<bundle>) identical to the bundle's Resources/public:
     * webpack resolves `<bundle>/js/...` from public/bundles, and `oro:assets:install` COPIES by
     * default — so without this, `oro:assets:build` alone bundles whatever an earlier install copied,
     * not the JS just compiled (nor SCSS changed since). Files removed from the bundle are removed
     * from the copy too. A symlinked install already shows the sources: nothing to do (false).
     */
    public function syncInstalledAssets(): bool
    {
        $target = $this->getInstalledAssetsDir();
        $source = $this->getBundlePublicDir();
        if (is_link($target) || !is_dir($source)) {
            return false;
        }
        (new Filesystem())->mirror($source, $target, null, ['override' => true, 'delete' => true]);

        return true;
    }

    /**
     * Writes a NEW asset version: Oro puts it on every asset URL (`app.js?v=…`, and webpack bakes it
     * into the lazy chunk URLs `chunk/<name>.js?v=…` when the build starts). Oro itself changes it
     * only on `composer install/update`, so an asset build without Composer kept the old URLs and
     * long-cached browsers kept running the previous JS against the new server. Must run BEFORE
     * webpack starts (the chunk URLs are fixed then). Returns the version written.
     */
    public function bumpAssetsVersion(): string
    {
        $version = bin2hex(random_bytes(4));
        (new Filesystem())->dumpFile($this->projectDir . '/' . self::ASSETS_VERSION_FILE, $version);

        return $version;
    }

    private function getTscBinary(): string
    {
        return $this->projectDir . '/node_modules/.bin/tsc';
    }

    /**
     * Runs the TypeScript compiler.
     *
     * @throws TypeScriptCompilationException when TypeScript is not installed or the tsconfig is missing
     */
    public function compile(): Process
    {
        if (!is_file($this->getTscBinary())) {
            throw new TypeScriptCompilationException(sprintf(
                'TypeScript compiler not found at "%s". Install it with "pnpm add -D typescript".',
                $this->getTscBinary()
            ));
        }
        if (!is_file($this->tsConfigPath)) {
            throw new TypeScriptCompilationException(
                sprintf('tsconfig not found at "%s".', $this->tsConfigPath)
            );
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
