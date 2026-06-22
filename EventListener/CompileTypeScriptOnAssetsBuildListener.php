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

        if (!$this->compiler->isAvailable()) {
            $event->getOutput()->writeln(
                sprintf('<comment>[%s] TypeScript not installed; skipping TS compilation.</comment>', $label)
            );

            return;
        }

        $event->getOutput()->writeln(sprintf('<info>[%s] Compiling TypeScript sources...</info>', $label));
        $process = $this->compiler->compile();
        if (!$process->isSuccessful()) {
            $event->getOutput()->writeln(sprintf('<error>[%s] TypeScript compilation failed:</error>', $label));
            $event->getOutput()->writeln($process->getOutput() . $process->getErrorOutput());

            return;
        }

        $event->getOutput()->writeln(sprintf('<info>[%s] TypeScript compiled.</info>', $label));
    }
}
