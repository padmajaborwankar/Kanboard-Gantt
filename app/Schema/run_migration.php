<?php

require_once __DIR__.'/../../vendor/autoload.php';

$pdo = new PDO('sqlite:'.__DIR__.'/../../data/db.sqlite');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$migration = new Schema\Migration($pdo);
$migration->up();

echo "Migration completed successfully!\n"; 