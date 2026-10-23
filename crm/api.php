<?php
/* Du Aidai CRM – API (JSON). Visi veiksmai tik prisijungus ir su CSRF žetonu. */
declare(strict_types=1);
require __DIR__ . '/../lib/auth.php';
require __DIR__ . '/../lib/crm.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');

function out($d, int $code = 200): never { http_response_code($code); echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function fail(string $m, int $code = 400, array $extra = []): never { out(['error' => $m] + $extra, $code); }

da_data_init();
da_session_start();
$me = da_user();
if (!$me) fail('Sesija baigėsi – prisijunkite iš naujo.', 401);
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !da_csrf_ok($_SERVER['HTTP_X_CSRF'] ?? null)) fail('Netinkama užklausa.', 403);

$a = (string)($_GET['a'] ?? '');
$in = [];
if (str_starts_with((string)($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) {
    $in = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($in)) fail('Netinkami duomenys.');
} else {
    $in = $_POST;
}
session_write_close(); /* sesijos nebekeičiame – leidžiame lygiagrečias užklausas */
da_crm_cleanup();

function pub_user(array $u, array $me): array
{
    return ['id' => $u['id'], 'name' => $u['name'], 'email' => $u['email'], 'twofa' => !empty($u['totp']['enabled']),
        'mustChange' => !empty($u['mustChange']), 'owner' => da_is_owner($u), 'disabled' => !empty($u['disabled']), 'me' => $u['id'] === $me['id'],
        'backupLeft' => count($u['backup'] ?? [])];
}
function users_out(array $me): array { return array_map(fn($u) => pub_user($u, $me), da_users()); }

/* duomenų „parašas“: pasikeitus bet kuriam failui, kiti administratoriai gauna naujus duomenis */
function sig(): string
{
    $s = '';
    foreach (['butai', 'uzklausos', 'klientai'] as $n) { $f = da_crm_file($n); clearstatcache(true, $f); $s .= is_file($f) ? filemtime($f) . ':' . filesize($f) . ';' : '-;'; }
    return md5($s);
}
function new_count(): int { return count(array_filter(da_crm_read('uzklausos'), fn($q) => $q['status'] === 'nauja')); }
function settings_out(): array
{
    $S = da_crm_read('nustatymai');
    $S['oldCount'] = da_crm_old_count((int)$S['retentionMonths']);
    $S['notifyEnv'] = (string)(getenv('FORM_TO_EMAIL') ?: '');
    return $S;
}
/* versijų konfliktas: įrašą ką tik pakeitė kitas administratorius */
function check_rev(array $cur, array $in): void
{
    if (isset($in['rev']) && (int)$in['rev'] !== (int)($cur['rev'] ?? 0))
        fail('Šį įrašą ką tik pakeitė ' . ($cur['by'] ?: 'kitas administratorius') . '. Duomenys atnaujinti – patikrinkite ir pakartokite.', 409, ['current' => $cur]);
}
function stamp(array $r, array $me): array { $r['rev'] = (int)($r['rev'] ?? 0) + 1; $r['updated'] = date('c'); $r['by'] = $me['name']; return $r; }
function find_idx(array $list, string $id): int { foreach ($list as $i => $x) if (($x['id'] ?? '') === $id) return $i; return -1; }

/* ---------- butai ---------- */
function apt_clean(array $n, array $o): array
{
    $st = in_array($n['status'] ?? '', DA_APT_ST, true) ? $n['status'] : $o['status'];
    $prem = [];
    foreach (array_slice(is_array($n['premises'] ?? null) ? $n['premises'] : [], 0, 30) as $p) {
        $name = da_clean($p['name'] ?? '', 60);
        if ($name === '') continue;
        $prem[] = ['name' => $name, 'area' => da_num($p['area'] ?? 0, 1000)];
    }
    $plan = (string)($n['plan'] ?? '');
    if ($plan !== '' && !preg_match('~^uploads/planai/[a-z0-9\-]+\.webp$~', $plan)) $plan = $o['plan'];
    return array_merge($o, [
        'status' => $st, 'price' => (int)da_num($n['price'] ?? 0, 1e8), 'area' => da_num($n['area'] ?? 0, 1000),
        'rooms' => (int)da_num($n['rooms'] ?? 0, 20), 'balcony' => da_num($n['balcony'] ?? 0, 500), 'premises' => $prem, 'plan' => $plan,
    ]);
}
function apt_events(array $o, array $n, string $who): array
{
    $ev = [];
    foreach (['status', 'price', 'area'] as $k) if ($o[$k] != $n[$k]) $ev[] = ['apt' => $n['id'], 'field' => $k, 'from' => $o[$k], 'to' => $n[$k], 'by' => $who];
    return $ev;
}
function apt_desc(array $ev): string
{
    $L = ['status' => 'būsena', 'price' => 'kaina', 'area' => 'plotas'];
    return implode(', ', array_map(fn($e) => $L[$e['field']] . ' ' . $e['from'] . ' → ' . $e['to'], $ev));
}

/* ---------- nuotraukos (butų planai) ---------- */
const DA_MAX_IMG = 8 * 1024 * 1024;
function upload_plan(array $f, string $aptId): string
{
    if (($f['error'] ?? 1) === UPLOAD_ERR_INI_SIZE || ($f['size'] ?? 0) > DA_MAX_IMG) fail('Nuotrauka per didelė. Didžiausia leidžiama – 8 MB.');
    if (($f['error'] ?? 1) !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) fail('Nepavyko įkelti failo.');
    $info = @getimagesize($f['tmp_name']);
    $type = $info[2] ?? 0;
    $src = match ($type) {
        IMAGETYPE_JPEG => @imagecreatefromjpeg($f['tmp_name']),
        IMAGETYPE_PNG => @imagecreatefrompng($f['tmp_name']),
        IMAGETYPE_WEBP => @imagecreatefromwebp($f['tmp_name']),
        default => false,
    };
    if (!$src) fail('Tinka tik JPG, PNG arba WebP nuotraukos.');
    $w = imagesx($src); $h = imagesy($src);
    if ($w < 300 || $h < 200) fail('Nuotrauka per maža (mažiausiai 300×200 px).');
    $k = min(1, 2400 / max($w, $h)); $nw = (int)round($w * $k); $nh = (int)round($h * $k);
    $im = imagecreatetruecolor($nw, $nh);
    imagealphablending($im, false); imagesavealpha($im, true);
    imagecopyresampled($im, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
    @mkdir(DA_UPLOADS . '/planai', 0755, true);
    $rel = 'uploads/planai/' . strtolower($aptId) . '-' . bin2hex(random_bytes(3)) . '.webp';
    imagewebp($im, DA_ROOT . '/' . $rel, 84);
    imagedestroy($im); imagedestroy($src);
    return $rel;
}

/* ---------- klientai ---------- */
function client_clean(array $n, array $o, array $aptIds): array
{
    $c = array_merge($o, [
        'first' => da_clean($n['first'] ?? '', 60), 'last' => da_clean($n['last'] ?? '', 60),
        'email' => strtolower(da_clean($n['email'] ?? '', 120)), 'phone' => da_clean($n['phone'] ?? '', 30),
        'apt' => in_array($n['apt'] ?? '', $aptIds, true) ? $n['apt'] : '',
        'comment' => da_clean($n['comment'] ?? '', 5000),
        'status' => in_array($n['status'] ?? '', DA_CLIENT_ST, true) ? $n['status'] : 'Potencialus',
        'price' => (int)da_num($n['price'] ?? 0, 1e8),
    ]);
    if ($c['first'] === '' && $c['last'] === '') fail('Įrašykite kliento vardą arba pavardę.');
    if ($c['email'] !== '' && !filter_var($c['email'], FILTER_VALIDATE_EMAIL)) fail('Neteisingas el. pašto adresas.');
    if ($c['phone'] !== '' && !da_phone_ok($c['phone'])) fail('Neteisingas telefono numeris.');
    return $c;
}
function new_client(): array
{
    return ['id' => da_id(), 'first' => '', 'last' => '', 'email' => '', 'phone' => '', 'apt' => '', 'comment' => '', 'status' => 'Potencialus',
        'price' => 0, 'docs' => [], 'inq' => '', 'created' => date('c'), 'rev' => 0, 'updated' => '', 'by' => ''];
}
/* failo turinys turi atitikti plėtinį (ne tik pavadinimas) */
function doc_ok(string $path, string $ext): bool
{
    $head = (string)file_get_contents($path, false, null, 0, 8);
    return match ($ext) {
        'docx', 'xlsx', 'odt', 'ods' => str_starts_with($head, "PK\x03\x04"),
        'doc', 'xls' => str_starts_with($head, "\xD0\xCF\x11\xE0"),
        'pdf' => str_starts_with($head, '%PDF'),
        'csv' => !str_contains((string)file_get_contents($path, false, null, 0, 65536), "\0"),
        default => false,
    };
}

/* ---------- veiksmai ---------- */
try {
    switch ($a) {
        case 'state':
            $B = da_crm_read('butai');
            out(['me' => pub_user($me, $me), 'users' => users_out($me), 'houses' => $B['houses'], 'apts' => $B['apartments'],
                'inqs' => da_crm_read('uzklausos'), 'clients' => da_crm_read('klientai'), 'settings' => settings_out(),
                'events' => array_slice(da_crm_read('ivykiai'), 0, 2000), 'log' => array_slice(da_json_read(DA_DATA . '/zurnalas.json', []), 0, 80),
                'sig' => sig(), 'docExt' => DA_DOC_EXT, 'docMax' => DA_DOC_MAX]);

        case 'ping':
            out(['sig' => sig(), 'new' => new_count()]);

        case 'apt-quick': /* greitas keitimas apžvalgoje: vienas laukas */
        case 'apt-save':
            $id = (string)($in['id'] ?? ($in['apt']['id'] ?? ''));
            [$old, $new] = da_crm_tx('butai', function (array &$B) use ($a, $id, $in, $me) {
                $i = find_idx($B['apartments'], $id);
                if ($i < 0) fail('Butas nerastas.');
                $o = $B['apartments'][$i];
                if ($a === 'apt-quick') {
                    $f = (string)($in['field'] ?? '');
                    if (!in_array($f, ['status', 'price', 'area'], true)) fail('Netinkamas laukas.');
                    $n = apt_clean([$f => $in['value'] ?? null] + $o, $o);
                } else {
                    check_rev($o, $in['apt']);
                    $n = apt_clean($in['apt'], $o);
                }
                if ($n == $o) return [$o, $o];
                $n = stamp($n, $me);
                $B['apartments'][$i] = $n;
                return [$o, $n];
            });
            $ev = apt_events($old, $new, $me['name']);
            da_crm_events($ev);
            if ($new !== $old) da_log($me['name'], 'Butas ' . $new['no'] . ': ' . ($ev ? apt_desc($ev) : 'atnaujinti duomenys'));
            out(['ok' => true, 'apt' => $new, 'events' => array_slice(da_crm_read('ivykiai'), 0, 2000)]);

        case 'plan-upload':
            $id = preg_replace('/[^A-Za-z0-9]/', '', (string)($in['id'] ?? ''));
            if (empty($_FILES['file'])) fail('Failas negautas (gal per didelis?).');
            $rel = upload_plan($_FILES['file'], $id ?: 'butas');
            da_log($me['name'], 'Įkėlė plano nuotrauką ' . $rel);
            out(['ok' => true, 'src' => $rel]);

        case 'inq-update':
            $r = da_crm_tx('uzklausos', function (array &$Q) use ($in, $me) {
                $i = find_idx($Q, (string)($in['id'] ?? ''));
                if ($i < 0) fail('Užklausa nerasta (gal ištrinta).');
                $o = $Q[$i]; check_rev($o, $in);
                $n = $o;
                if (isset($in['status'])) {
                    if (!in_array($in['status'], DA_INQ_ST, true)) fail('Netinkama būsena.');
                    $n['status'] = $in['status'];
                    if ($n['status'] !== 'nauja' && $n['contactedAt'] === '') $n['contactedAt'] = date('c');
                }
                if (isset($in['note'])) $n['note'] = da_clean($in['note'], 2000);
                if ($n == $o) return $o;
                return $Q[$i] = stamp($n, $me);
            });
            out(['ok' => true, 'inq' => $r, 'new' => new_count()]);

        case 'inq-delete':
            $r = da_crm_tx('uzklausos', function (array &$Q) use ($in) {
                $i = find_idx($Q, (string)($in['id'] ?? ''));
                if ($i < 0) fail('Užklausa nerasta.');
                $r = $Q[$i]; array_splice($Q, $i, 1); return $r;
            });
            da_log($me['name'], 'Ištrynė užklausą (' . $r['name'] . ', ' . date('Y-m-d', strtotime($r['t'])) . ')');
            out(['ok' => true, 'new' => new_count()]);

        case 'client-save':
            $aptIds = array_column(da_crm_read('butai')['apartments'], 'id');
            [$c, $what] = da_crm_tx('klientai', function (array &$K) use ($in, $me, $aptIds) {
                $n = is_array($in['client'] ?? null) ? $in['client'] : [];
                $i = find_idx($K, (string)($n['id'] ?? ''));
                if ($i < 0) { $c = stamp(client_clean($n, new_client(), $aptIds), $me); array_unshift($K, $c); return [$c, 'Sukūrė']; }
                check_rev($K[$i], $n);
                $c = client_clean($n, $K[$i], $aptIds);
                if ($c == $K[$i]) return [$c, ''];
                return [$K[$i] = stamp($c, $me), 'Atnaujino'];
            });
            if ($what) da_log($me['name'], $what . ' klientą ' . trim($c['first'] . ' ' . $c['last']));
            out(['ok' => true, 'client' => $c]);

        case 'client-from-inq': /* importuoti klientą iš užklausos */
            $q = null;
            foreach (da_crm_read('uzklausos') as $x) if ($x['id'] === ($in['id'] ?? '')) $q = $x;
            if (!$q) fail('Užklausa nerasta.');
            if ($q['client'] !== '' && find_idx(da_crm_read('klientai'), $q['client']) >= 0) out(['ok' => true, 'client' => da_crm_read('klientai')[find_idx(da_crm_read('klientai'), $q['client'])], 'existed' => true]);
            $B = da_crm_read('butai');
            $ai = find_idx($B['apartments'], $q['apt']);
            $parts = preg_split('/\s+/u', trim($q['name']), 2);
            $c = new_client();
            $c = array_merge($c, ['first' => $parts[0] ?? '', 'last' => $parts[1] ?? '', 'email' => $q['email'], 'phone' => $q['phone'],
                'apt' => $ai >= 0 ? $q['apt'] : '', 'price' => $ai >= 0 ? (int)$B['apartments'][$ai]['price'] : 0, 'inq' => $q['id'],
                'comment' => 'Užklausa ' . date('Y-m-d H:i', strtotime($q['t'])) . ':' . "\n" . $q['msg'] . ($q['note'] !== '' ? "\n\nPastaba: " . $q['note'] : '')]);
            $c = stamp($c, $me);
            da_crm_tx('klientai', function (array &$K) use ($c) { array_unshift($K, $c); });
            $inq = da_crm_tx('uzklausos', function (array &$Q) use ($q, $c, $me) {
                $i = find_idx($Q, $q['id']); if ($i < 0) return null;
                $Q[$i]['client'] = $c['id'];
                return $Q[$i] = stamp($Q[$i], $me);
            });
            da_log($me['name'], 'Importavo klientą iš užklausos: ' . $q['name']);
            out(['ok' => true, 'client' => $c, 'inq' => $inq]);

        case 'client-delete':
            $c = da_crm_tx('klientai', function (array &$K) use ($in) {
                $i = find_idx($K, (string)($in['id'] ?? ''));
                if ($i < 0) fail('Klientas nerastas.');
                $c = $K[$i]; array_splice($K, $i, 1); return $c;
            });
            foreach ($c['docs'] as $d) @unlink(DA_DOCS . '/' . $d['id'] . '.' . $d['ext']);
            da_crm_tx('uzklausos', function (array &$Q) use ($c) { foreach ($Q as &$q) if ($q['client'] === $c['id']) $q['client'] = ''; });
            da_log($me['name'], 'Ištrynė klientą ' . trim($c['first'] . ' ' . $c['last']));
            out(['ok' => true]);

        case 'doc-upload':
            $f = $_FILES['file'] ?? null;
            if (!$f || ($f['error'] ?? 1) === UPLOAD_ERR_INI_SIZE || ($f['size'] ?? 0) > DA_DOC_MAX) fail('Failas per didelis arba negautas. Didžiausias leidžiamas – 10 MB.');
            if (($f['error'] ?? 1) !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) fail('Nepavyko įkelti failo.');
            $ext = strtolower(pathinfo((string)$f['name'], PATHINFO_EXTENSION));
            if (!in_array($ext, DA_DOC_EXT, true)) fail('Tinka Word, Excel, PDF, OpenDocument ar CSV failai.');
            if (!doc_ok($f['tmp_name'], $ext)) fail('Failo turinys neatitinka jo tipo (.' . $ext . ').');
            $doc = ['id' => da_id(), 'name' => da_clean(basename((string)$f['name']), 120), 'ext' => $ext, 'size' => (int)$f['size'], 't' => date('c'), 'by' => $me['name']];
            da_crm_init();
            $c = da_crm_tx('klientai', function (array &$K) use ($in, $doc, $f, $me) {
                $i = find_idx($K, (string)($in['client'] ?? ''));
                if ($i < 0) fail('Klientas nerastas – pirmiausia išsaugokite klientą.');
                if (count($K[$i]['docs']) >= 50) fail('Vienam klientui – iki 50 dokumentų.');
                if (!move_uploaded_file($f['tmp_name'], DA_DOCS . '/' . $doc['id'] . '.' . $doc['ext'])) fail('Nepavyko išsaugoti failo.');
                $K[$i]['docs'][] = $doc;
                return $K[$i] = stamp($K[$i], $me);
            });
            da_log($me['name'], 'Prisegė dokumentą „' . $doc['name'] . '“ klientui ' . trim($c['first'] . ' ' . $c['last']));
            out(['ok' => true, 'client' => $c]);

        case 'doc-delete':
            [$c, $doc] = da_crm_tx('klientai', function (array &$K) use ($in, $me) {
                $i = find_idx($K, (string)($in['client'] ?? ''));
                if ($i < 0) fail('Klientas nerastas.');
                $j = find_idx($K[$i]['docs'], (string)($in['doc'] ?? ''));
                if ($j < 0) fail('Dokumentas nerastas.');
                $doc = $K[$i]['docs'][$j];
                array_splice($K[$i]['docs'], $j, 1);
                return [$K[$i] = stamp($K[$i], $me), $doc];
            });
            @unlink(DA_DOCS . '/' . $doc['id'] . '.' . $doc['ext']);
            da_log($me['name'], 'Ištrynė dokumentą „' . $doc['name'] . '“');
            out(['ok' => true, 'client' => $c]);

        case 'settings-save':
            $notify = [];
            foreach (array_slice((array)($in['notify'] ?? []), 0, 5) as $em) {
                $em = strtolower(da_clean($em, 120));
                if ($em === '') continue;
                if (!filter_var($em, FILTER_VALIDATE_EMAIL)) fail('Neteisingas el. paštas: ' . $em);
                $notify[] = $em;
            }
            $months = (int)($in['retentionMonths'] ?? 24);
            if (!in_array($months, [6, 12, 18, 24, 36, 0], true)) fail('Netinkamas laikotarpis.');
            $ga = (array)($in['ga'] ?? []);
            da_crm_tx('nustatymai', function (array &$S) use ($notify, $months, $ga) {
                $S['notify'] = $notify; $S['retentionMonths'] = $months;
                $S['ga'] = ['measurementId' => da_clean($ga['measurementId'] ?? '', 30), 'propertyId' => da_clean($ga['propertyId'] ?? '', 30), 'connected' => !empty($ga['connected'])];
            });
            da_log($me['name'], 'Pakeitė CRM nustatymus');
            out(['ok' => true, 'settings' => settings_out()]);

        case 'cleanup-now':
            $n = da_crm_cleanup(true);
            out(['ok' => true, 'deleted' => $n, 'settings' => settings_out()]);

        case 'password':
            if (!password_verify((string)($in['old'] ?? ''), $me['hash'])) fail('Dabartinis slaptažodis neteisingas.');
            if ($e = da_pw_problem((string)($in['new'] ?? ''))) fail($e);
            $u = da_update_user($me['id'], fn($x) => array_merge($x, ['hash' => password_hash((string)$in['new'], PASSWORD_DEFAULT), 'pwv' => ($x['pwv'] ?? 0) + 1]));
            session_start(); $_SESSION['pwv'] = $u['pwv']; session_write_close(); /* ši sesija lieka, kitos atjungiamos */
            da_log($me['name'], 'Pasikeitė slaptažodį');
            out(['ok' => true]);

        case '2fa-setup':
            $secret = da_b32enc(random_bytes(20));
            session_start(); $_SESSION['totp_new'] = $secret; session_write_close();
            $label = rawurlencode('Du Aidai CRM:' . $me['email']);
            out(['secret' => $secret, 'uri' => "otpauth://totp/$label?secret=$secret&issuer=" . rawurlencode('Du Aidai CRM') . '&digits=6&period=30']);

        case '2fa-enable':
            session_start(); $secret = $_SESSION['totp_new'] ?? ''; session_write_close();
            if (!$secret) fail('Pradėkite iš naujo.');
            $step = da_totp_check($secret, (string)($in['code'] ?? ''));
            if (!$step) fail('Kodas neteisingas. Patikrinkite, ar telefono laikas teisingas, ir bandykite dar kartą.');
            $codes = []; $hashes = [];
            for ($i = 0; $i < 10; $i++) { $c = strtolower(bin2hex(random_bytes(4))); $codes[] = substr($c, 0, 4) . '-' . substr($c, 4); $hashes[] = password_hash($c, PASSWORD_DEFAULT); }
            da_update_user($me['id'], fn($x) => array_merge($x, ['totp' => ['secret' => $secret, 'enabled' => true, 'last' => $step], 'backup' => $hashes]));
            session_start(); unset($_SESSION['totp_new']); session_write_close();
            da_log($me['name'], 'Įjungė dviejų žingsnių patvirtinimą');
            out(['ok' => true, 'codes' => $codes]);

        case '2fa-disable':
            if (!password_verify((string)($in['password'] ?? ''), $me['hash'])) fail('Slaptažodis neteisingas.');
            da_update_user($me['id'], fn($x) => array_merge($x, ['totp' => null, 'backup' => []]));
            da_log($me['name'], 'Išjungė dviejų žingsnių patvirtinimą');
            out(['ok' => true, 'me' => pub_user(da_find_user('id', $me['id']), $me)]);

        case 'user-add':
        case 'user-reset':
        case 'user-toggle':
        case 'user-delete':
            if (!da_is_owner($me)) fail('Paskyras kurti ir keisti gali tik pagrindinis administratorius.', 403);
            if ($a !== 'user-add' && da_is_owner(da_find_user('id', (string)($in['id'] ?? '')))) fail('Pagrindinio administratoriaus paskyros keisti negalima.', 403);
            break;
    }
    switch ($a) {
        case 'user-add':
            $name = da_clean($in['name'] ?? '', 60); $email = strtolower(da_clean($in['email'] ?? '', 120));
            if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Įveskite vardą ir teisingą el. paštą.');
            if (da_find_user('email', $email)) fail('Toks el. paštas jau yra.');
            $temp = da_temp_password();
            $all = da_users();
            $all[] = ['id' => bin2hex(random_bytes(6)), 'email' => $email, 'name' => $name, 'hash' => password_hash($temp, PASSWORD_DEFAULT),
                'pwv' => 1, 'mustChange' => true, 'created' => date('c'), 'totp' => null, 'backup' => []];
            da_users_save($all);
            da_log($me['name'], 'Sukūrė paskyrą ' . $email);
            out(['ok' => true, 'temp' => $temp, 'users' => users_out($me)]);

        case 'user-reset':
            $id = (string)($in['id'] ?? '');
            $u = da_find_user('id', $id);
            if (!$u) fail('Paskyra nerasta.');
            $temp = da_temp_password();
            da_update_user($id, fn($x) => array_merge($x, ['hash' => password_hash($temp, PASSWORD_DEFAULT), 'mustChange' => true, 'pwv' => ($x['pwv'] ?? 0) + 1,
                'totp' => !empty($in['reset2fa']) ? null : ($x['totp'] ?? null), 'backup' => !empty($in['reset2fa']) ? [] : ($x['backup'] ?? [])]));
            da_log($me['name'], 'Nustatė laikiną slaptažodį: ' . $u['email'] . (!empty($in['reset2fa']) ? ' (ir išjungė 2FA)' : ''));
            out(['ok' => true, 'temp' => $temp, 'users' => users_out($me)]);

        case 'user-toggle':
            $id = (string)($in['id'] ?? '');
            if ($id === $me['id']) fail('Savo paskyros išjungti negalima.');
            $u = da_update_user($id, fn($x) => array_merge($x, ['disabled' => empty($x['disabled'])]));
            if (!$u) fail('Paskyra nerasta.');
            da_log($me['name'], ($u['disabled'] ? 'Išjungė' : 'Įjungė') . ' paskyrą ' . $u['email']);
            out(['ok' => true, 'users' => users_out($me)]);

        case 'user-delete':
            $id = (string)($in['id'] ?? '');
            if ($id === $me['id']) fail('Savo paskyros ištrinti negalima.');
            $u = da_find_user('id', $id);
            if (!$u) fail('Paskyra nerasta.');
            da_users_save(array_filter(da_users(), fn($x) => $x['id'] !== $id));
            da_log($me['name'], 'Ištrynė paskyrą ' . $u['email']);
            out(['ok' => true, 'users' => users_out($me)]);
    }
    fail('Nežinomas veiksmas.', 404);
} catch (RuntimeException $e) {
    fail($e->getMessage());
}
