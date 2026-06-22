<?php

declare(strict_types=1);

namespace Aaxis\Bundle\CommonBundle;

use Symfony\Component\HttpKernel\Bundle\Bundle;

/**
 * Shared base bundle for the Aaxis Oro bundles.
 *
 * Provides cross-cutting infrastructure reused by the other Aaxis bundles so it is defined once:
 * the TypeScript build pipeline, the shared top-level "Aaxis" application-menu group and its icon,
 * and a base TypeScript configuration.
 */
class AaxisCommonBundle extends Bundle
{
}
