<?php

declare(strict_types=1);

namespace Aaxis\Bundle\CommonBundle\Exception;

/**
 * Thrown when a bundle's TypeScript cannot be compiled — the toolchain is missing, the tsconfig is
 * absent, or tsc itself reported a failure.
 *
 * Extends \RuntimeException so the existing broad catches in CompileTypeScriptCommand and
 * CompileTypeScriptOnAssetsBuildListener keep converting a failed compile into a clean error.
 */
class TypeScriptCompilationException extends \RuntimeException
{
}
