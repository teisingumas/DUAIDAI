<?php
/* Lokaliai: php -S 127.0.0.1:8813 scripts/dev-router.php  →  http://127.0.0.1:8813/ ir /crm/ */
$root = dirname(__DIR__);
$p = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (preg_match('~^/(lib|_data|scripts)(/|$)~', $p)) { http_response_code(403); exit; }
if ($p === '/crm' ) { header('Location: /crm/'); exit; }
if ($p === '/crm/') { chdir($root . '/crm'); require $root . '/crm/index.php'; return true; }
return false;
