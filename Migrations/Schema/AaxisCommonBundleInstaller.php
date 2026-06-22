<?php

declare(strict_types=1);

namespace Aaxis\Bundle\CommonBundle\Migrations\Schema;

use Doctrine\DBAL\Schema\Schema;
use Oro\Bundle\MigrationBundle\Migration\Installation;
use Oro\Bundle\MigrationBundle\Migration\QueryBag;

/**
 * Creates the AaxisCommonBundle database schema: the per-user DataGrid layout preferences shared by
 * every Aaxis grid. Single, consolidated install reflecting the current state.
 */
class AaxisCommonBundleInstaller implements Installation
{
    private const string JSONB_NULL = 'JSONB DEFAULT NULL';

    #[\Override]
    public function getMigrationVersion(): string
    {
        return 'v1_0';
    }

    #[\Override]
    public function up(Schema $schema, QueryBag $queries): void
    {
        $table = $schema->createTable('aaxis_grid_preference');
        $table->addColumn('id', 'integer', ['autoincrement' => true]);
        $table->addColumn('user_id', 'integer', ['notnull' => false]);
        $table->addColumn('grid_key', 'string', ['length' => 100]);
        $table->addColumn('state', 'json', ['notnull' => false, 'columnDefinition' => self::JSONB_NULL]);
        $table->setPrimaryKey(['id']);
        $table->addUniqueIndex(['user_id', 'grid_key'], 'aaxis_grid_pref_user_grid_uidx');

        $table->addForeignKeyConstraint(
            $schema->getTable('oro_user'),
            ['user_id'],
            ['id'],
            ['onDelete' => 'CASCADE', 'onUpdate' => null]
        );
    }
}
