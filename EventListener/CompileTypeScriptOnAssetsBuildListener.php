<?php

declare(strict_types=1);

namespace Aaxis\Bundle\CommonBundle\EventListener;

use Aaxis\Bundle\CommonBundle\Build\TypeScriptCompiler;
use Symfony\Component\Console\ConsoleEvents;
use Symfony\Component\Console\Event\ConsoleCommandEvent;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

/**
 * Compiles a bundle's TypeScript right before the Oro asset build runs, so the freshly emitted ES
 * modules are available when webpack bundles the assets.
 *
 * Shared across the Aaxis bundles: each registers an instance with its own compiler.
 */
class CompileTypeScriptOnAssetsBuildListener implements EventSubscriberInterface
{
    /** Asset commands that should trigger a TypeScript (re)compilation beforehand. */
    private const array TRIGGER_COMMANDS = ['oro:assets:build', 'oro:assets:install'];

    public function __construct(private readonly TypeScriptCompiler $compiler)
    {
    }

    public static function getSubscribedEvents(): array
    {
        return [
            ConsoleEvents::COMMAND => 'onConsoleCommand',
        ];
    }

    public function onConsoleCommand(ConsoleCommandEvent $event): void
    {
        $command = $event->getCommand();
        if (null === $command || !\in_array($command->getName(), self::TRIGGER_COMMANDS, true)) {
            return;
        }

        $label = $this->compiler->getLabel();
        $output = $event->getOutput();

        // Not one of our packages in a build context (e.g. installed as a plain vendor/ dependency
        // that ships its own assets) — nothing to do.
        if (!$this->compiler->shouldCompile()) {
            return;
        }

        // This bundle ships no committed JS, so its TypeScript MUST compile here. If the toolchain is
        // missing or compilation fails, abort the asset build loudly rather than silently shipping a
        // UI with no JS.
        $output->writeln(sprintf('<info>[%s] Compiling TypeScript sources...</info>', $label));

        try {
            $process = $this->compiler->compile();
        } catch (\RuntimeException $e) {
            throw new \RuntimeException(sprintf(
                '[%s] Cannot compile TypeScript and there is no committed JS to fall back on: %s',
                $label,
                $e->getMessage()
            ), 0, $e);
        }

        if (!$process->isSuccessful()) {
            $output->writeln(sprintf('<error>[%s] TypeScript compilation failed:</error>', $label));
            $output->writeln($process->getOutput() . $process->getErrorOutput());

            throw new \RuntimeException(sprintf(
                '[%s] TypeScript compilation failed; aborting asset build.',
                $label
            ));
        }

        $output->writeln(sprintf('<info>[%s] TypeScript compiled.</info>', $label));
    }
}
