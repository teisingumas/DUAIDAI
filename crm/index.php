<?php
/* Du Aidai CRM – prisijungimas ir CRM skydelis (/crm/) */
declare(strict_types=1);
require __DIR__ . '/../lib/auth.php';

da_data_init();
da_bootstrap_users();
da_session_start();

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
header('X-Frame-Options: DENY');
header("Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'");

$a = (string)($_GET['a'] ?? '');
$post = $_SERVER['REQUEST_METHOD'] === 'POST';
$msg = ''; $err = '';

function go(string $to = '/crm/'): never { header('Location: ' . $to); exit; }

/* dalinai prisijungęs naudotojas (laukia 2FA ar slaptažodžio keitimo) */
function da_pending_user(): ?array
{
    $id = $_SESSION['uid'] ?? null;
    if (!$id) return null;
    $u = da_find_user('id', $id);
    return ($u && empty($u['disabled'])) ? $u : null;
}
/* kitas prisijungimo žingsnis po slaptažodžio / 2FA */
function da_next_stage(array $u, bool $twofaDone): void
{
    $_SESSION['uid'] = $u['id'];
    $_SESSION['pwv'] = $u['pwv'] ?? 0;
    $_SESSION['seen'] = time();
    if (!$twofaDone && !empty($u['totp']['enabled']) && !da_device_ok($u)) { $_SESSION['stage'] = '2fa'; $_SESSION['full'] = false; return; }
    if (!empty($u['mustChange'])) { $_SESSION['stage'] = 'change'; $_SESSION['full'] = false; return; }
    $_SESSION['stage'] = 'ok'; $_SESSION['full'] = true;
    da_log($u['name'], 'Prisijungė');
}

/* ---------- veiksmai ---------- */
if ($a === 'logout') {
    if ($post && da_csrf_ok($_POST['csrf'] ?? null)) { $u = da_user(); if ($u) da_log($u['name'], 'Atsijungė'); da_logout(); }
    go();
}

$user = da_user();
if (session_status() !== PHP_SESSION_ACTIVE) da_session_start(); /* sesija baigėsi – nauja */
$stage = $_SESSION['stage'] ?? '';

if ($post && !da_csrf_ok($_POST['csrf'] ?? null)) {
    $err = 'Puslapis pasibaigė – bandykite dar kartą.';
} elseif ($post && $a === '' && !$user && $stage === '') {
    /* 1 žingsnis: el. paštas + slaptažodis */
    $email = strtolower(trim((string)($_POST['email'] ?? '')));
    $pw = (string)($_POST['password'] ?? '');
    $keys = ['ip:' . da_ip(), 'em:' . $email];
    if ($wait = da_locked($keys)) {
        $err = 'Per daug nesėkmingų bandymų. Bandykite po ' . ceil($wait / 60) . ' min.';
    } else {
        $u = da_find_user('email', $email);
        $ok = password_verify($pw, $u['hash'] ?? '$2y$10$.DYZO7ImSe.ASfZhFwo8e.xOOafYjF1sAFOXgSHQL5lmm6hxuXz8.');
        if ($u && $ok && empty($u['disabled'])) {
            da_clear_fails($keys);
            session_regenerate_id(true);
            if (password_needs_rehash($u['hash'], PASSWORD_DEFAULT)) da_update_user($u['id'], fn($x) => ['hash' => password_hash($pw, PASSWORD_DEFAULT)] + $x);
            da_next_stage($u, false);
            go();
        }
        da_fail($keys);
        $err = 'Neteisingas el. paštas arba slaptažodis.';
    }
} elseif ($post && $stage === '2fa' && ($pu = da_pending_user())) {
    /* 2 žingsnis: kodas iš programėlės arba atsarginis kodas */
    $code = trim((string)($_POST['code'] ?? ''));
    $keys = ['ip:' . da_ip(), 'em:' . $pu['email']];
    if ($wait = da_locked($keys)) {
        $err = 'Per daug nesėkmingų bandymų. Bandykite po ' . ceil($wait / 60) . ' min.';
    } else {
        $ok = false;
        $step = da_totp_check($pu['totp']['secret'] ?? '', $code, (int)($pu['totp']['last'] ?? 0));
        if ($step) { $ok = true; $pu = da_update_user($pu['id'], function ($x) use ($step) { $x['totp']['last'] = $step; return $x; }); }
        else {
            $norm = strtolower(preg_replace('/[^a-z0-9]/i', '', $code));
            foreach ($pu['backup'] ?? [] as $i => $h) {
                if ($norm !== '' && password_verify($norm, $h)) {
                    $ok = true;
                    $pu = da_update_user($pu['id'], function ($x) use ($i) { unset($x['backup'][$i]); $x['backup'] = array_values($x['backup']); return $x; });
                    da_log($pu['name'], 'Prisijungė su atsarginiu kodu');
                    break;
                }
            }
        }
        if ($ok) {
            da_clear_fails($keys);
            if (!empty($_POST['remember'])) da_device_cookie_set($pu);
            da_next_stage($pu, true);
            go();
        }
        da_fail($keys);
        $err = 'Neteisingas kodas.';
    }
} elseif ($post && $stage === 'change' && ($pu = da_pending_user())) {
    /* privalomas slaptažodžio keitimas (pirmas prisijungimas) */
    $p1 = (string)($_POST['p1'] ?? ''); $p2 = (string)($_POST['p2'] ?? '');
    if ($p1 !== $p2) $err = 'Slaptažodžiai nesutampa.';
    elseif ($e = da_pw_problem($p1)) $err = $e;
    elseif (password_verify($p1, $pu['hash'])) $err = 'Naujas slaptažodis turi skirtis nuo laikino.';
    else {
        $pu = da_update_user($pu['id'], fn($x) => array_merge($x, ['hash' => password_hash($p1, PASSWORD_DEFAULT), 'mustChange' => false, 'pwv' => ($x['pwv'] ?? 0) + 1]));
        session_regenerate_id(true);
        da_log($pu['name'], 'Pasikeitė laikiną slaptažodį');
        da_next_stage($pu, true);
        go();
    }
} elseif ($post && $a === 'forgot') {
    $email = strtolower(trim((string)($_POST['email'] ?? '')));
    $keys = ['ip:' . da_ip()];
    if (!da_locked($keys)) {
        $u = da_find_user('email', $email);
        if ($u && empty($u['disabled'])) {
            $tok = bin2hex(random_bytes(24));
            da_update_user($u['id'], fn($x) => array_merge($x, ['reset' => ['h' => hash('sha256', $tok), 'exp' => time() + 3600]]));
            $link = da_base_url() . '/crm/?a=reset&u=' . $u['id'] . '&t=' . $tok;
            da_mail($u['email'], 'Du Aidai – slaptažodžio atkūrimas',
                "Sveiki, {$u['name']},\n\nNorėdami nustatyti naują slaptažodį, atidarykite šią nuorodą (galioja 1 valandą):\n\n{$link}\n\nJei slaptažodžio atkurti neprašėte, šį laišką tiesiog ištrinkite.\n\nDu Aidai");
            da_log($u['name'], 'Paprašė slaptažodžio atkūrimo');
        }
        da_fail($keys); /* riboja laiškų siuntimą iš vieno IP */
    }
    $msg = 'Jei šis el. paštas yra sistemoje, išsiuntėme nuorodą slaptažodžiui atkurti. Patikrinkite ir „Šlamšto“ aplanką.';
} elseif ($a === 'setup') {
    /* pirmas slaptažodis be el. laiško: vienkartinė nuoroda */
    $keys = ['ip:' . da_ip()];
    $u = da_find_user('email', DA_OWNER_EMAIL);
    $tok = (string)($_GET['t'] ?? '');
    if (!$u || empty($u['initial'])) { $err = 'Slaptažodis jau nustatytas – prisijunkite arba naudokite „Pamiršau slaptažodį“.'; $a = ''; }
    elseif ($wait = da_locked($keys)) { $err = 'Per daug bandymų. Bandykite po ' . ceil($wait / 60) . ' min.'; $a = ''; }
    elseif (!hash_equals(DA_SETUP_HASH, hash('sha256', $tok))) { da_fail($keys); $err = 'Nuoroda neteisinga.'; $a = ''; }
    elseif ($post) {
        $p1 = (string)($_POST['p1'] ?? ''); $p2 = (string)($_POST['p2'] ?? '');
        if ($p1 !== $p2) $err = 'Slaptažodžiai nesutampa.';
        elseif ($e = da_pw_problem($p1)) $err = $e;
        else {
            da_update_user($u['id'], fn($x) => array_merge($x, ['hash' => password_hash($p1, PASSWORD_DEFAULT), 'mustChange' => false, 'initial' => false, 'pwv' => ($x['pwv'] ?? 0) + 1]));
            da_log($u['name'], 'Nusistatė pirmą slaptažodį (vienkartinė nuoroda)');
            da_logout(); da_session_start();
            $msg = 'Slaptažodis nustatytas. Prisijunkite.'; $a = ''; $stage = '';
        }
    }
} elseif ($a === 'reset') {
    $u = da_find_user('id', (string)($_GET['u'] ?? ''));
    $tok = (string)($_GET['t'] ?? '');
    $valid = $u && !empty($u['reset']) && $u['reset']['exp'] > time() && hash_equals($u['reset']['h'], hash('sha256', $tok));
    if (!$valid) { $err = 'Nuoroda nebegalioja. Paprašykite naujos.'; $a = 'forgot'; }
    elseif ($post) {
        $p1 = (string)($_POST['p1'] ?? ''); $p2 = (string)($_POST['p2'] ?? '');
        if ($p1 !== $p2) $err = 'Slaptažodžiai nesutampa.';
        elseif ($e = da_pw_problem($p1)) $err = $e;
        else {
            da_update_user($u['id'], function ($x) use ($p1) { unset($x['reset']); return array_merge($x, ['hash' => password_hash($p1, PASSWORD_DEFAULT), 'mustChange' => false, 'initial' => false, 'pwv' => ($x['pwv'] ?? 0) + 1]); });
            da_log($u['name'], 'Atkūrė slaptažodį per el. paštą');
            da_logout(); da_session_start();
            $msg = 'Slaptažodis pakeistas. Prisijunkite su nauju slaptažodžiu.'; $a = ''; $stage = '';
        }
    }
}

if (isset($_GET['cancel'])) { da_logout(); go(); }

$user = da_user();
if (session_status() !== PHP_SESSION_ACTIVE) da_session_start();
$stage = $_SESSION['stage'] ?? '';
$csrf = da_csrf();
$pending = $user ? null : da_pending_user();

/* ---------- išvaizda ---------- */
function auth_page(string $title, string $body): void
{
    ?><!doctype html>
<html lang="lt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title><?= e($title) ?> – Du Aidai CRM</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="crm.css?v=<?= DA_V ?>">
</head>
<body class="auth">
<main class="auth-box">
  <div class="auth-logo"><svg viewBox="0 0 284 293" aria-hidden="true"><path d="M0,95 L116,34 L116,293 L93,293 L93,109 L33,139 L33,293 L0,293Z"/><path d="M168,0 L284,59 L284,293 L249,293 L249,102 L191,71 L191,293 L168,293Z"/></svg><b>Du Aidai</b><span>CRM</span></div>
  <?= $body ?>
</main>
</body>
</html>
<?php
    exit;
}
$note = ($err ? '<p class="note bad" role="alert">' . e($err) . '</p>' : '') . ($msg ? '<p class="note ok" role="status">' . e($msg) . '</p>' : '');
$hid = '<input type="hidden" name="csrf" value="' . e($csrf) . '">';

if (!$user) {
    if ($pending && $stage === '2fa') {
        auth_page('Patvirtinimas', '<h1>Patvirtinimo kodas</h1><p class="lead">Įveskite 6 skaitmenų kodą iš programėlės (Google Authenticator ar kt.). Jei telefono neturite – įveskite atsarginį kodą.</p>' . $note . '
<form method="post" action="/crm/">' . $hid . '
<label>Kodas<input name="code" inputmode="numeric" autocomplete="one-time-code" autofocus required maxlength="20"></label>
<label class="chk"><input type="checkbox" name="remember" value="1"> Atsiminti šį įrenginį 30 dienų</label>
<button class="btn">Patvirtinti</button></form>
<p class="sub"><a href="/crm/?cancel=1">Atšaukti</a></p>');
    }
    if ($pending && $stage === 'change') {
        auth_page('Naujas slaptažodis', '<h1>Susikurkite slaptažodį</h1><p class="lead">Sveiki, ' . e($pending['name']) . '. Prisijungėte su laikinu slaptažodžiu – susikurkite savo. Bent 10 simbolių; ilgis svarbiau už ženklus.</p>' . $note . '
<form method="post" action="/crm/">' . $hid . '
<label>Naujas slaptažodis<input type="password" name="p1" autocomplete="new-password" minlength="10" required autofocus></label>
<label>Pakartokite<input type="password" name="p2" autocomplete="new-password" minlength="10" required></label>
<button class="btn">Išsaugoti ir tęsti</button></form>
<p class="sub"><a href="/crm/?cancel=1">Atšaukti</a></p>');
    }
    if ($a === 'forgot') {
        auth_page('Slaptažodžio atkūrimas', '<h1>Pamiršote slaptažodį?</h1><p class="lead">Įveskite savo el. paštą – atsiųsime nuorodą naujam slaptažodžiui nustatyti.</p>' . $note . '
<form method="post" action="/crm/?a=forgot">' . $hid . '
<label>El. paštas<input type="email" name="email" autocomplete="username" required autofocus></label>
<button class="btn">Siųsti nuorodą</button></form>
<p class="sub"><a href="/crm/">← Grįžti į prisijungimą</a></p>');
    }
    if ($a === 'setup') {
        auth_page('Pirmas slaptažodis', '<h1>Susikurkite slaptažodį</h1><p class="lead">' . e(DA_OWNER_EMAIL) . '. Bent 10 simbolių; ilgis svarbiau už ženklus.</p>' . $note . '
<form method="post" action="/crm/?a=setup&amp;t=' . e($_GET['t'] ?? '') . '">' . $hid . '
<label>Slaptažodis<input type="password" name="p1" autocomplete="new-password" minlength="10" required autofocus></label>
<label>Pakartokite<input type="password" name="p2" autocomplete="new-password" minlength="10" required></label>
<button class="btn">Išsaugoti</button></form>');
    }
    if ($a === 'reset') {
        auth_page('Naujas slaptažodis', '<h1>Naujas slaptažodis</h1>' . $note . '
<form method="post" action="/crm/?a=reset&amp;u=' . e($_GET['u'] ?? '') . '&amp;t=' . e($_GET['t'] ?? '') . '">' . $hid . '
<label>Naujas slaptažodis<input type="password" name="p1" autocomplete="new-password" minlength="10" required autofocus></label>
<label>Pakartokite<input type="password" name="p2" autocomplete="new-password" minlength="10" required></label>
<button class="btn">Išsaugoti</button></form>');
    }
    auth_page('Prisijungimas', '<h1>Prisijungimas</h1>' . $note . '
<form method="post" action="/crm/">' . $hid . '
<label>El. paštas<input type="email" name="email" autocomplete="username" required autofocus></label>
<label>Slaptažodis<input type="password" name="password" autocomplete="current-password" required></label>
<button class="btn">Prisijungti</button></form>
<p class="sub"><a href="/crm/?a=forgot">Pamiršau slaptažodį</a></p>' . (da_first_run() ? '<p class="note info" style="margin-top:18px">Pirmas prisijungimas? Spauskite „Pamiršau slaptažodį“ ir įveskite savo el. paštą – atsiųsime nuorodą slaptažodžiui susikurti.</p>' : ''));
}

/* ---------- CRM skydelis ---------- */
?><!doctype html>
<html lang="lt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="csrf" content="<?= e($csrf) ?>">
<title>Du Aidai CRM</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="crm.css?v=<?= DA_V ?>">
</head>
<body class="app">
<header class="top">
  <button class="menu-btn" id="menuBtn" aria-label="Meniu" aria-expanded="false"><span></span><span></span></button>
  <a class="top-logo" href="/crm/"><svg viewBox="0 0 284 293" aria-hidden="true"><path d="M0,95 L116,34 L116,293 L93,293 L93,109 L33,139 L33,293 L0,293Z"/><path d="M168,0 L284,59 L284,293 L249,293 L249,102 L191,71 L191,293 L168,293Z"/></svg><b>Du Aidai</b><small>CRM</small></a>
  <div class="search" role="search">
    <input id="q" type="search" placeholder="Ieškoti: vardas, telefonas, el. paštas, butas…" aria-label="Paieška" autocomplete="off">
    <div class="search-res" id="qRes" hidden></div>
  </div>
  <a class="btn ghost small top-site" href="/" target="_blank" rel="noopener">Svetainė ↗</a>
</header>
<nav class="side" id="side" aria-label="Skyriai"></nav>
<main class="main" id="main"><p class="loading">Kraunama…</p></main>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<form id="logoutForm" method="post" action="/crm/?a=logout" hidden><input type="hidden" name="csrf" value="<?= e($csrf) ?>"></form>
<script src="qrcode.js?v=<?= DA_V ?>"></script>
<script src="crm.js?v=<?= DA_V ?>"></script>
</body>
</html>
