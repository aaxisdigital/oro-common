<?php

declare(strict_types=1);

namespace Aaxis\Bundle\CommonBundle\Command;

use Aaxis\Bundle\CommonBundle\Build\TypeScriptCompiler;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Compiles a bundle's TypeScript sources into ES modules.
 *
 * Shared across the Aaxis bundles: each registers an instance with its own compiler and command
 * name. Runs on demand and is also triggered automatically before "oro:assets:build"
 * (see CompileTypeScriptOnAssetsBuildListener).
 */
class CompileTypeScriptCommand extends Command
{
    public function __construct(
        private readonly TypeScriptCompiler $compiler,
        ?string $name = null,
    ) {
        parent::__construct($name);
    }

    #[\Override]
    protected function configure(): void
    {
        $this->setDescription(sprintf('Compiles %s TypeScript sources into JavaScript.', $this->compiler->getLabel()));
    }

    #[\Override]
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        // Foreign vendor package that ships its own assets — nothing for us to build.
        if (!$this->compiler->shouldCompile()) {
            $io->note('Not a build context for this package; nothing to compile.');

            return Command::SUCCESS;
        }

        // This bundle ships no committed JS, so a missing toolchain is a hard error, not a skip.
        try {
            $process = $this->compiler->compile();
        } catch (\RuntimeException $e) {
            $io->error($e->getMessage());

            return Command::FAILURE;
        }

        if (!$process->isSuccessful()) {
            $io->error('TypeScript compilation failed.');
            $output->writeln($process->getOutput());
            $output->writeln($process->getErrorOutput());

            return Command::FAILURE;
        }

        $io->success(sprintf('%s TypeScript sources compiled.', $this->compiler->getLabel()));

        return Command::SUCCESS;
    }
}
