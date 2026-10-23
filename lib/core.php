<?php
/* Du Aidai CRM – bendras branduolys: duomenų failai, sesija, pagalbinės funkcijos.
   Duomenys laikomi aplanke šalia public_html (../duaidai-data), o jei ten rašyti negalima – _data/ (uždaryta .htaccess). */
declare(strict_types=1);

const DA_V = '20261022d';            /* CSS/JS versija (naršyklės podėlio atnaujinimui) */
define('DA_ROOT', dirname(__DIR__));
define('DA_DATA', (function (): string {
    $out = dirname(DA_ROOT) . '/duaidai-data';
    if (is_dir($out) || @is_writable(dirname(DA_ROOT))) return $out;
    return DA_ROOT . '/_data';
})());
define('DA_UPLOADS', DA_ROOT . '/uploads');

function da_json_read(string $f, $def = null)
{
    if (!is_file($f)) return $def;
    $j = json_decode((string)file_get_contents($f), true);
    return $j === null ? $def : $j;
}

function da_json_write(string $f, $data): void
{
    $dir = dirname($f);
    if (!is_dir($dir)) mkdir($dir, 0750, true);
    $tmp = $f . '.' . bin2hex(random_bytes(4)) . '.tmp';
    file_put_contents($tmp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), LOCK_EX);
    rename($tmp, $f);
}

/* pirmas paleidimas: sukuriami duomenų aplankai */
function da_data_init(): void
{
    foreach ([DA_DATA, DA_DATA . '/sesijos', DA_UPLOADS] as $d) {
        if (!is_dir($d)) mkdir($d, 0750, true);
    }
    if (!is_file(DA_DATA . '/.htaccess')) file_put_contents(DA_DATA . '/.htaccess', "Require all denied\n");
    if (!is_file(DA_UPLOADS . '/.htaccess')) {
        /* įkeltuose failuose kodas niekada nevykdomas */
        file_put_contents(DA_UPLOADS . '/.htaccess', "Options -Indexes -ExecCGI\nRemoveHandler .php .phtml .php3 .php4 .php5 .php7 .php8 .phar\nRemoveType .php .phtml .phar\n<FilesMatch \"\\.(php\\d?|phtml|phar|pl|py|cgi|sh|html?|svg|js)$\">\nRequire all denied\n</FilesMatch>\n");
    }
}

function da_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https'
        || (int)($_SERVER['SERVER_PORT'] ?? 0) === 443;
}

function da_session_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    da_data_init();
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', '28800');
    session_save_path(DA_DATA . '/sesijos');
    session_name('dacrm');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/crm/', 'secure' => da_https(), 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
}

const DA_IDLE = 8 * 3600; /* sesija baigiasi po 8 val. neveiklumo */

function da_users(): array { return da_json_read(DA_DATA . '/users.json', []); }
function da_users_save(array $u): void { da_json_write(DA_DATA . '/users.json', array_values($u)); }

/* prisijungęs administratorius arba null (tik visiškai prisijungęs: slaptažodis + 2FA, jei įjungta) */
function da_user(): ?array
{
    if (session_status() !== PHP_SESSION_ACTIVE) return null;
    $id = $_SESSION['uid'] ?? null;
    if (!$id || empty($_SESSION['full'])) return null;
    if (time() - (int)($_SESSION['seen'] ?? 0) > DA_IDLE) { da_logout(); return null; }
    foreach (da_users() as $u) {
        if ($u['id'] === $id && empty($u['disabled'])) {
            if (($u['pwv'] ?? 0) !== ($_SESSION['pwv'] ?? -1)) { da_logout(); return null; } /* slaptažodis pakeistas kitur */
            $_SESSION['seen'] = time();
            return $u;
        }
    }
    da_logout();
    return null;
}

function da_logout(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) return;
    $_SESSION = [];
    $p = session_get_cookie_params();
    setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => $p['samesite']]);
    session_destroy();
}

function e($s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
