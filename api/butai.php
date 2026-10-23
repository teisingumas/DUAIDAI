<?php
/* Du Aidai – vieši butų duomenys svetainei (būsena, kaina, plotas, kambariai, patalpos, planas). Valdoma per /crm/. */
declare(strict_types=1);
require __DIR__ . '/../lib/crm.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache');
header('X-Content-Type-Options: nosniff');
echo json_encode(['apts' => da_public_apts()], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
