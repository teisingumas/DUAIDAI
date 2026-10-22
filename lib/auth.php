<?php
/* Du Aidai CRM – prisijungimas: slaptažodžiai, bandymų ribojimas, CSRF, 2FA (TOTP), laiškai */
declare(strict_types=1);
require_once __DIR__ . '/core.php';

const DA_MAX_FAILS = 5;          /* nesėkmingi bandymai iki užrakto */
const DA_LOCK_SEC = 15 * 60;     /* užrakto trukmė */
const DA_DEVICE_DAYS = 30;       /* „Atsiminti šį įrenginį“ */

function da_secret(): string
{
    $f = DA_DATA . '/secret.key';
    if (!is_file($f)) { da_data_init(); file_put_contents($f, bin2hex(random_bytes(32)), LOCK_EX); chmod($f, 0600); }
    return trim((string)file_get_contents($f));
}

/* Pirmas paleidimas: sukuriama pagrindinio administratoriaus paskyra su atsitiktiniu (niekam nežinomu) slaptažodžiu.
   Savo slaptažodį jis nusistato per „Pamiršau slaptažodį“ – nuoroda ateina tik į jo el. paštą.
   Taip repozitorijoje (ji vieša) nėra jokio slaptažodžio. */
function da_bootstrap_users(): void
{
    if (is_file(DA_DATA . '/users.json')) return;
    da_users_save([[
        'id' => bin2hex(random_bytes(6)), 'email' => DA_OWNER_EMAIL, 'name' => 'Deividas', 'hash' => password_hash(bin2hex(random_bytes(24)), PASSWORD_DEFAULT),
        'pwv' => 1, 'mustChange' => false, 'initial' => true, 'created' => date('c'), 'totp' => null, 'backup' => [],
    ]]);
}
/* ar pagrindinis administratorius dar nėra nusistatęs slaptažodžio */
function da_first_run(): bool { foreach (da_users() as $u) if (!empty($u['initial'])) return true; return false; }

/* pagrindinis administratorius: tik jis kuria, išjungia ir trina paskyras */
const DA_OWNER_EMAIL = 'deividas15@gmail.com';
function da_is_owner(?array $u): bool { return $u !== null && strtolower((string)$u['email']) === DA_OWNER_EMAIL; }

function da_find_user(string $field, string $val): ?array
{
    foreach (da_users() as $u) if (strtolower((string)($u[$field] ?? '')) === strtolower($val)) return $u;
    return null;
}

function da_update_user(string $id, callable $fn): ?array
{
    $all = da_users(); $out = null;
    foreach ($all as $i => $u) if ($u['id'] === $id) { $all[$i] = $fn($u); $out = $all[$i]; }
    da_users_save($all);
    return $out;
}

function da_ip(): string { return (string)($_SERVER['REMOTE_ADDR'] ?? '0'); }

/* ---------- bandymų ribojimas ---------- */
function da_limits(): array { return da_json_read(DA_DATA . '/limits.json', []); }
function da_locked(array $keys): int
{
    $L = da_limits(); $max = 0;
    foreach ($keys as $k) if (isset($L[$k]['until']) && $L[$k]['until'] > time()) $max = max($max, $L[$k]['until'] - time());
    return $max;
}
function da_fail(array $keys): void
{
    $L = da_limits(); $now = time();
    foreach ($L as $k => $v) if (($v['t'] ?? 0) < $now - 86400) unset($L[$k]);
    foreach ($keys as $k) {
        $v = $L[$k] ?? ['n' => 0];
        if (($v['until'] ?? 0) && $v['until'] <= $now) $v = ['n' => 0];
        $v['n'] = ($v['n'] ?? 0) + 1; $v['t'] = $now;
        /* el. paštui – 5 bandymai, visam IP (pvz. biuro tinklui) – 20 */
        if ($v['n'] >= (str_starts_with($k, 'ip:') ? DA_MAX_FAILS * 4 : DA_MAX_FAILS)) $v['until'] = $now + DA_LOCK_SEC;
        $L[$k] = $v;
    }
    da_json_write(DA_DATA . '/limits.json', $L);
}
function da_clear_fails(array $keys): void
{
    $L = da_limits(); foreach ($keys as $k) unset($L[$k]); da_json_write(DA_DATA . '/limits.json', $L);
}

/* ---------- CSRF ---------- */
function da_csrf(): string
{
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}
function da_csrf_ok(?string $t): bool { return is_string($t) && !empty($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $t); }

/* ---------- slaptažodžiai ---------- */
function da_pw_problem(string $pw): ?string
{
    if (mb_strlen($pw) < 10) return 'Slaptažodis turi būti bent 10 simbolių.';
    if (mb_strlen($pw) > 200) return 'Slaptažodis per ilgas.';
    return null;
}
function da_temp_password(): string
{
    $a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; $s = '';
    for ($i = 0; $i < 14; $i++) $s .= $a[random_int(0, strlen($a) - 1)];
    return substr($s, 0, 4) . '-' . substr($s, 4, 5) . '-' . substr($s, 9);
}

/* ---------- TOTP (RFC 6238), suderinama su Google Authenticator ir kt. ---------- */
function da_b32enc(string $bin): string
{
    $map = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; $bits = ''; $out = '';
    foreach (str_split($bin) as $c) $bits .= str_pad(decbin(ord($c)), 8, '0', STR_PAD_LEFT);
    foreach (str_split($bits, 5) as $chunk) $out .= $map[bindec(str_pad($chunk, 5, '0'))];
    return $out;
}
function da_b32dec(string $s): string
{
    $map = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; $bits = ''; $out = '';
    foreach (str_split(strtoupper(preg_replace('/[^A-Za-z2-7]/', '', $s))) as $c) $bits .= str_pad(decbin(strpos($map, $c)), 5, '0', STR_PAD_LEFT);
    foreach (str_split($bits, 8) as $b) if (strlen($b) === 8) $out .= chr(bindec($b));
    return $out;
}
function da_totp(string $secret, int $step): string
{
    $h = hash_hmac('sha1', pack('N2', 0, $step), da_b32dec($secret), true);
    $o = ord($h[19]) & 0xf;
    $n = ((ord($h[$o]) & 0x7f) << 24) | (ord($h[$o + 1]) << 16) | (ord($h[$o + 2]) << 8) | ord($h[$o + 3]);
    return str_pad((string)($n % 1000000), 6, '0', STR_PAD_LEFT);
}
/* grąžina panaudotą žingsnį arba null; tas pats kodas antrą kartą nepriimamas */
function da_totp_check(string $secret, string $code, int $lastStep = 0): ?int
{
    $code = preg_replace('/\D/', '', $code);
    if (strlen($code) !== 6) return null;
    $now = intdiv(time(), 30);
    for ($d = -1; $d <= 1; $d++) {
        $s = $now + $d;
        if ($s > $lastStep && hash_equals(da_totp($secret, $s), $code)) return $s;
    }
    return null;
}

/* „Atsiminti šį įrenginį“ – pasirašytas slapukas */
function da_device_cookie_set(array $u): void
{
    $exp = time() + DA_DEVICE_DAYS * 86400;
    $v = $u['id'] . '.' . $exp . '.' . hash_hmac('sha256', $u['id'] . '|' . $exp . '|' . ($u['totp']['secret'] ?? ''), da_secret());
    setcookie('dadev_' . $u['id'], $v, ['expires' => $exp, 'path' => '/crm/', 'secure' => da_https(), 'httponly' => true, 'samesite' => 'Strict']);
}
function da_device_ok(array $u): bool
{
    $v = $_COOKIE['dadev_' . $u['id']] ?? '';
    $p = explode('.', $v);
    if (count($p) !== 3 || $p[0] !== $u['id'] || (int)$p[1] < time()) return false;
    return hash_equals(hash_hmac('sha256', $p[0] . '|' . $p[1] . '|' . ($u['totp']['secret'] ?? ''), da_secret()), $p[2]);
}

/* ---------- žurnalas ---------- */
function da_log(string $who, string $what): void
{
    $f = DA_DATA . '/zurnalas.json';
    $L = da_json_read($f, []);
    array_unshift($L, ['t' => date('c'), 'who' => $who, 'what' => $what, 'ip' => da_ip()]);
    da_json_write($f, array_slice($L, 0, 500));
}

/* ---------- laiškai ---------- */
function da_mail(string $to, string $subject, string $body): bool
{
    $host = preg_replace('~^https?://(www\.)?|:\d+$~', '', da_base_url());
    $headers = "From: Du Aidai <no-reply@{$host}>\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit";
    if (da_local()) { /* lokaliai laiškai neišsiunčiami – įrašomi į failą */
        file_put_contents(DA_DATA . '/laiskai.log', date('c') . " → $to\n$subject\n$body\n\n", FILE_APPEND | LOCK_EX);
        return true;
    }
    return @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, $headers);
}

/* nuorodoms laiškuose naudojamas tik leidžiamas domenas (apsauga nuo suklastotos Host antraštės).
   Perkeliant į kliento domeną – įrašykite jį į DA_HOSTS. */
const DA_HOSTS = ['cornflowerblue-bison-370650.hostingersite.com', 'duaidai.lt', 'www.duaidai.lt', '127.0.0.1:8813'];
function da_local(): bool { return strtolower((string)($_SERVER['HTTP_HOST'] ?? '')) === '127.0.0.1:8813'; }
function da_base_url(): string
{
    $host = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
    if (!in_array($host, DA_HOSTS, true)) $host = DA_HOSTS[0];
    return ($host === '127.0.0.1:8813' ? 'http://' : 'https://') . $host;
}
