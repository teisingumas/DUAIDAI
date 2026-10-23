<?php
/* Du Aidai CRM – butai, užklausos, klientai, dokumentai.
   Duomenys DA_DATA/crm (ne git, iš naršyklės neprieinami). Svetainė butų duomenis gauna per /api/butai.php. */
declare(strict_types=1);
require_once __DIR__ . '/core.php';

define('DA_CRM', DA_DATA . '/crm');
define('DA_DOCS', DA_CRM . '/dokumentai');

const DA_APT_ST = ['Laisvas', 'Rezervuotas', 'Parduotas'];
const DA_INQ_ST = ['nauja', 'susisiekta', 'uzdaryta'];
const DA_CLIENT_ST = ['Potencialus', 'Apžiūra', 'Derybos', 'Rezervavo', 'Pirko', 'Atsisakė'];
const DA_DOC_EXT = ['doc', 'docx', 'xls', 'xlsx', 'pdf', 'odt', 'ods', 'csv'];
const DA_DOC_MAX = 10 * 1024 * 1024; /* 10 MB */
const DA_PLAN_DEFAULT = 'img/butas.webp';

function da_crm_init(): void
{
    da_data_init();
    foreach ([DA_CRM, DA_DOCS] as $d) if (!is_dir($d)) mkdir($d, 0750, true);
}
function da_crm_file(string $name): string { return DA_CRM . '/' . $name . '.json'; }

function da_crm_default(string $name): array
{
    return match ($name) {
        'butai' => da_crm_seed(),
        'nustatymai' => ['retentionMonths' => 24, 'notify' => [], 'cleaned' => '', 'ga' => ['measurementId' => '', 'propertyId' => '', 'connected' => false]],
        default => [],
    };
}
function da_crm_read(string $name): array
{
    $d = da_json_read(da_crm_file($name));
    if (is_array($d)) return $d;
    return da_crm_tx($name, fn(array &$x) => $x);
}

/* skaitymas–keitimas–rašymas su užraktu: keli administratoriai vienu metu nesugadina vienas kito pakeitimų.
   $fn gauna duomenis per nuorodą (function (array &$d) {...}) ir grąžina atsakymą. */
function da_crm_tx(string $name, callable $fn)
{
    da_crm_init();
    $lock = fopen(DA_CRM . '/.' . $name . '.lock', 'c');
    flock($lock, LOCK_EX);
    try {
        $f = da_crm_file($name);
        $data = da_json_read($f);
        if (!is_array($data)) $data = da_crm_default($name);
        $before = $data;
        $ret = $fn($data);
        if ($data !== $before || !is_file($f)) da_json_write($f, $data);
        return $ret;
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function da_id(): string { return date('ymd') . bin2hex(random_bytes(4)); }

/* ---------- pradiniai butai: tie patys 64 butai, kurie dabar sugeneruoti index.html (namai A, B; 5–2 aukštai; po 8 butus) ---------- */
const DA_HOUSES = ['A', 'B'];
const DA_FLOORS = [5, 4, 3, 2];
const DA_TYPES = [
    [3, 7.2, [['Svetainė su virtuve', 31.2], ['Miegamasis', 14.6], ['Miegamasis', 12.1], ['Vonios kambarys', 6.3], ['Prieškambaris', 8.4], ['Sandėliukas', 5.8]]],
    [2, 6.0, [['Svetainė su virtuve', 24.8], ['Miegamasis', 13.2], ['Vonios kambarys', 5.4], ['Prieškambaris', 9.2]]],
    [2, 6.0, [['Svetainė su virtuve', 25.6], ['Miegamasis', 13.4], ['Vonios kambarys', 5.6], ['Prieškambaris', 9.5]]],
    [2, 8.5, [['Svetainė su virtuve', 29.4], ['Miegamasis', 14.8], ['Vonios kambarys', 6.1], ['Prieškambaris', 11.0]]],
    [3, 9.4, [['Svetainė su virtuve', 30.1], ['Miegamasis', 13.8], ['Miegamasis', 11.6], ['Vonios kambarys', 6.2], ['Prieškambaris', 8.9], ['Sandėliukas', 4.2]]],
    [2, 10.1, [['Svetainė su virtuve', 27.3], ['Miegamasis', 13.6], ['Vonios kambarys', 5.9], ['Prieškambaris', 11.4]]],
    [2, 11.2, [['Svetainė su virtuve', 28.2], ['Miegamasis', 14.1], ['Vonios kambarys', 6.0], ['Prieškambaris', 11.4]]],
    [3, 10.6, [['Svetainė su virtuve', 31.4], ['Miegamasis', 14.2], ['Miegamasis', 11.9], ['Vonios kambarys', 6.4], ['Prieškambaris', 8.1], ['Sandėliukas', 4.5]]],
];
/* ta pati maiša kaip index.html (FNV-1a), kad rezervuoti butai sutaptų */
function da_hash(string $s): float
{
    $h = 2166136261;
    foreach (mb_str_split($s) as $c) { $h ^= mb_ord($c); $h = ($h * 16777619) & 0xFFFFFFFF; }
    return $h / 4294967295;
}
function da_crm_seed(): array
{
    $apts = [];
    foreach (DA_HOUSES as $bi => $b) foreach (DA_FLOORS as $f) {
        $floor = [];
        foreach (DA_TYPES as $i => [$k, $bal, $rooms]) {
            $pos = str_pad((string)($i + 1), 2, '0', STR_PAD_LEFT);
            $id = $b . $f . $pos;
            $area = round(array_sum(array_column($rooms, 1)) * 10) / 10;
            $floor[$id] = [
                'id' => $id, 'house' => $b, 'floor' => $f, 'no' => $b . '-' . $f . $pos,
                'status' => da_hash($id) < 0.27 ? 'Rezervuotas' : 'Laisvas',
                'price' => (int)(round($area * (2380 + $f * 70 + $bi * 60) / 100) * 100),
                'area' => $area, 'rooms' => $k, 'balcony' => $bal,
                'premises' => array_map(fn($r) => ['name' => $r[0], 'area' => $r[1]], $rooms),
                'plan' => '', 'rev' => 1, 'updated' => '', 'by' => '',
            ];
        }
        /* kiekviename aukšte bent 1 rezervuotas ir bent 1 laisvas (kaip index.html) */
        $ids = array_keys($floor);
        usort($ids, fn($x, $y) => da_hash($x) <=> da_hash($y));
        if (!array_filter($floor, fn($a) => $a['status'] === 'Rezervuotas')) $floor[$ids[0]]['status'] = 'Rezervuotas';
        if (!array_filter($floor, fn($a) => $a['status'] === 'Laisvas')) $floor[end($ids)]['status'] = 'Laisvas';
        array_push($apts, ...array_values($floor));
    }
    return [
        'houses' => array_map(fn($b) => ['id' => $b, 'name' => 'Namas ' . $b, 'floors' => DA_FLOORS], DA_HOUSES),
        'apartments' => $apts,
    ];
}

/* viešai svetainei – tik tai, ką rodo butų puslapiai */
function da_public_apts(): array
{
    $B = da_json_read(da_crm_file('butai'));
    if (!is_array($B)) return [];
    return array_map(fn($a) => [
        'id' => $a['id'], 'status' => $a['status'], 'price' => $a['status'] === 'Laisvas' ? $a['price'] : 0,
        'area' => $a['area'], 'rooms' => $a['rooms'], 'balcony' => $a['balcony'], 'premises' => $a['premises'],
        'plan' => $a['plan'] ?: '',
    ], $B['apartments']);
}

function da_clean($v, int $max = 3000): string
{
    $s = is_scalar($v) ? (string)$v : '';
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s) ?? '';
    return mb_substr(trim($s), 0, $max);
}
function da_phone_ok(string $p): bool { return (bool)preg_match('~^\+?[0-9][0-9 ()\-]{5,19}$~', $p); }
function da_num($v, float $max = 1e9): float { return is_numeric($v) ? max(0.0, min($max, round((float)$v, 2))) : 0.0; }

/* ---------- butų pakeitimų istorija (analitikai: kada parduota, rezervuota) ---------- */
function da_crm_events(array $list): void
{
    if (!$list) return;
    da_crm_tx('ivykiai', function (array &$E) use ($list) {
        foreach ($list as $ev) array_unshift($E, ['t' => date('c')] + $ev);
        $E = array_slice($E, 0, 5000);
    });
}

/* ---------- užklausos iš svetainės ---------- */
function da_inq_add(array $f): array
{
    $r = ['id' => da_id(), 't' => date('c'), 'apt' => $f['apt'], 'name' => $f['name'], 'phone' => $f['phone'], 'email' => $f['email'],
        'msg' => $f['msg'], 'status' => 'nauja', 'note' => '', 'client' => '', 'contactedAt' => '',
        'rev' => 1, 'updated' => '', 'by' => ''];
    da_crm_tx('uzklausos', function (array &$Q) use ($r) { array_unshift($Q, $r); });
    return $r;
}

/* BDAR: senos užklausos ištrinamos automatiškai (ne dažniau kaip kartą per parą) */
function da_crm_cleanup(bool $force = false): int
{
    $S = da_crm_read('nustatymai');
    $months = (int)($S['retentionMonths'] ?? 24);
    if (!$force && ($S['cleaned'] ?? '') === date('Y-m-d')) return 0;
    da_crm_tx('nustatymai', function (array &$x) { $x['cleaned'] = date('Y-m-d'); });
    if ($months <= 0) return 0;
    $limit = da_crm_limit($months);
    $n = da_crm_tx('uzklausos', function (array &$Q) use ($limit) {
        $before = count($Q);
        $Q = array_values(array_filter($Q, fn($q) => strcmp($q['t'], $limit) >= 0));
        return $before - count($Q);
    });
    if ($n > 0 && function_exists('da_log')) da_log('Sistema', "Automatiškai ištrinta senų užklausų: $n (BDAR, senesnės nei $months mėn.)");
    return $n;
}
function da_crm_limit(int $months): string { return (new DateTimeImmutable())->modify("-$months months")->format('c'); }
function da_crm_old_count(int $months): int
{
    if ($months <= 0) return 0;
    $limit = da_crm_limit($months);
    return count(array_filter(da_crm_read('uzklausos'), fn($q) => strcmp($q['t'], $limit) < 0));
}
