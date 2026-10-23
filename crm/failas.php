<?php
/* Du Aidai CRM – kliento dokumento atsisiuntimas (tik prisijungusiems administratoriams) */
declare(strict_types=1);
require __DIR__ . '/../lib/auth.php';
require __DIR__ . '/../lib/crm.php';

da_session_start();
$me = da_user();
session_write_close();
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: private, no-store');
if (!$me) { http_response_code(401); exit('Prisijunkite iš naujo.'); }

$doc = null;
foreach (da_crm_read('klientai') as $c) {
    if ($c['id'] !== ($_GET['c'] ?? '')) continue;
    foreach ($c['docs'] as $d) if ($d['id'] === ($_GET['d'] ?? '')) $doc = $d;
}
$file = $doc ? DA_DOCS . '/' . $doc['id'] . '.' . $doc['ext'] : '';
if (!$doc || !is_file($file)) { http_response_code(404); exit('Dokumentas nerastas.'); }

$types = ['doc' => 'application/msword', 'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls' => 'application/vnd.ms-excel', 'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'pdf' => 'application/pdf', 'odt' => 'application/vnd.oasis.opendocument.text', 'ods' => 'application/vnd.oasis.opendocument.spreadsheet', 'csv' => 'text/csv'];
$ascii = preg_replace('/[^A-Za-z0-9._-]+/', '_', iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $doc['name']) ?: 'dokumentas.' . $doc['ext']);
header('Content-Type: ' . ($types[$doc['ext']] ?? 'application/octet-stream'));
header('X-Content-Type-Options: nosniff');
header('Content-Disposition: attachment; filename="' . $ascii . '"; filename*=UTF-8\'\'' . rawurlencode($doc['name']));
header('Content-Length: ' . filesize($file));
readfile($file);
