<?php
/* Du Aidai – užklausų forma („Teirautis dėl buto“). Užklausos patenka į CRM (/crm/ → Užklausos).
   Apsauga be „reCAPTCHA“: nematomas laukelis-spąstai, per greitas užpildymas, nuorodų šlamštas ir užklausų ribojimas iš vieno IP. */
declare(strict_types=1);
require __DIR__ . '/../lib/auth.php';
require __DIR__ . '/../lib/crm.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function reply(array $d, int $code = 200): never { http_response_code($code); echo json_encode($d, JSON_UNESCAPED_UNICODE); exit; }

const DA_FORM_LIMITS = [[600, 3], [86400, 10]]; /* per 10 min – 3, per parą – 10 užklausų iš vieno IP */

if ($_SERVER['REQUEST_METHOD'] !== 'POST') reply(['error' => 'Netinkama užklausa.'], 405);
/* tik iš šios svetainės (jei naršyklė nurodo kilmę) */
$origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origin !== '' && strtolower((string)parse_url($origin, PHP_URL_HOST) . (parse_url($origin, PHP_URL_PORT) ? ':' . parse_url($origin, PHP_URL_PORT) : '')) !== strtolower((string)($_SERVER['HTTP_HOST'] ?? '')))
    reply(['error' => 'Netinkama užklausa.'], 403);

$in = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($in)) $in = $_POST;

/* robotai: užpildytas nematomas laukelis arba forma užpildyta greičiau nei per 3 s – apsimetame, kad viskas gerai */
if (trim((string)($in['svetaine'] ?? '')) !== '' || (int)($in['ms'] ?? 0) < 3000) reply(['ok' => true]);

$name = da_clean($in['vardas'] ?? '', 80);
$email = strtolower(da_clean($in['el_pastas'] ?? '', 120));
$phone = da_clean($in['telefonas'] ?? '', 30);
$msg = da_clean($in['komentaras'] ?? '', 2000);
$apt = preg_replace('/[^A-Z0-9]/', '', strtoupper((string)($in['butas'] ?? '')));

if ($name === '') reply(['error' => 'Įrašykite vardą.'], 422);
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) reply(['error' => 'Įrašykite teisingą el. pašto adresą.'], 422);
if ($phone !== '' && !da_phone_ok($phone)) reply(['error' => 'Patikrinkite telefono numerį.'], 422);
/* nuorodų šlamštas */
if (preg_match_all('~https?://|www\.~i', $msg) > 2) reply(['ok' => true]);

$aptNo = '';
if ($apt !== '') {
    foreach (da_crm_read('butai')['apartments'] as $a) if ($a['id'] === $apt) $aptNo = $a['no'];
    if ($aptNo === '') $apt = '';
}

/* ribojimas iš vieno IP (saugoma tik IP maiša, ne pats adresas) */
$key = substr(hash_hmac('sha256', da_ip(), da_secret()), 0, 20);
$wait = da_crm_tx('formu-riba', function (array &$R) use ($key) {
    $now = time();
    foreach ($R as $k => $ts) { $R[$k] = array_values(array_filter($ts, fn($t) => $t > $now - 86400)); if (!$R[$k]) unset($R[$k]); }
    $mine = $R[$key] ?? [];
    foreach (DA_FORM_LIMITS as [$win, $max]) {
        $inWin = array_filter($mine, fn($t) => $t > $now - $win);
        if (count($inWin) >= $max) return min($inWin) + $win - $now;
    }
    $R[$key] = array_merge($mine, [$now]);
    return 0;
});
if ($wait > 0) reply(['error' => 'Iš jūsų tinklo gauta per daug užklausų. Pabandykite po ' . max(1, (int)ceil($wait / 60)) . ' min. arba paskambinkite mums.'], 429);

$r = da_inq_add(['apt' => $apt, 'name' => $name, 'phone' => $phone, 'email' => $email, 'msg' => $msg]);
da_crm_cleanup();

/* pranešimas administratoriams el. paštu */
$S = da_crm_read('nustatymai');
$to = array_unique(array_filter(array_merge($S['notify'] ?? [], [getenv('FORM_TO_EMAIL') ?: ''])));
if ($to) {
    $body = "Nauja užklausa iš svetainės Du Aidai\n\n"
        . ($aptNo ? "Butas: $aptNo\n" : '') . "Vardas: $name\nEl. paštas: $email\n" . ($phone ? "Telefonas: $phone\n" : '')
        . ($msg ? "\nKomentaras:\n$msg\n" : '') . "\nCRM: " . da_base_url() . "/crm/#uzklausos\n";
    foreach ($to as $t) da_mail($t, 'Nauja užklausa' . ($aptNo ? ' – butas ' . $aptNo : '') . ' (Du Aidai)', $body);
}
reply(['ok' => true]);
