# Du Aidai

Gyvenamųjų namų kvartalo „Du Aidai“ (Kaunas, 2027 Q3) svetainė.

- `index.html` – visa svetainė
- `img/` – nuotraukos (hero, namai, aukšto ir buto planai, brokerė)
- `crm/` – CRM (prisijungimas, butai, užklausos, klientai, analitika) – adresu `/crm/`
- `api/` – `butai.php` (butų duomenys svetainei), `uzklausa.php` (užklausų forma → CRM)
- `lib/` – CRM branduolys (PHP), iš naršyklės neprieinamas

Peržiūrai užtenka atidaryti `index.html` naršyklėje (tada rodomi pavyzdiniai butų duomenys, forma nesiunčiama).
Su CRM lokaliai: `php -S 127.0.0.1:8813 scripts/dev-router.php` → http://127.0.0.1:8813/ ir http://127.0.0.1:8813/crm/
(laiškai lokaliai neišsiunčiami, o įrašomi į `../duaidai-data/laiskai.log`).

## CRM

- **Prisijungimas** `/crm/` – el. paštas + slaptažodis, 2FA (Google Authenticator), „Atsiminti įrenginį“, bandymų ribojimas.
  Pirmą kartą: „Pamiršau slaptažodį“ → nuoroda ateina į pagrindinio administratoriaus el. paštą (deividas15@gmail.com).
  Jokių slaptažodžių repozitorijoje nėra. Kitas paskyras (pvz. dar 2 administratorius) kuria pagrindinis administratorius.
- **Butai** – suskirstyti pagal namą ir aukštą: būsena, kaina, bendras plotas, kambariai, balkonas, patalpos ir jų plotai, plano nuotrauka.
  Svetainė duomenis ima iš `api/butai.php`, pakeitimai matomi iš karto. Pirmą kartą atidarius CRM butai sukuriami tokie pat, kaip dabar `index.html`.
- **Apžvalga** – rodikliai, naujos užklausos, greitas butų valdymas (būsena, kaina, plotas).
- **Užklausos** – iš formos „Teirautis dėl buto“: būsena Nauja → Susisiekta → Uždaryta, pastabos, kas keitė, filtrai, paieška, CSV.
  Apsauga: nematomas laukelis-spąstai, per greitas užpildymas, nuorodų šlamštas, 3 užklausos / 10 min. ir 10 / parą iš vieno IP.
  BDAR: senos užklausos trinamos automatiškai (numatyta 24 mėn., keičiama „Nustatymuose“).
- **Klientai** – kortelės su dokumentais (Word, Excel, PDF iki 10 MB), importas iš užklausos, filtrai, CSV ir PDF (spausdinimo langas).
- **Analitika** – parduota / rezervuota / laisva, užklausos per mėnesį, piltuvėlis; Google Analytics – kol kas demo langas.

**Duomenys** laikomi serveryje aplanke `duaidai-data/` šalia `public_html` (jei ten rašyti negalima – `_data/`),
plano nuotraukos – `uploads/`. Abu ne git; diegiant naują versiją jų **netrinti**.
Pranešimų apie naujas užklausas gavėjai nustatomi CRM „Nustatymuose“ (arba `FORM_TO_EMAIL` hostinge).
Reikia PHP 8.1+ su GD (WebP) – Hostinger tai turi.

## Kaip dirbame

1. Užduotį pasirenkam iš [Issues](../../issues).
2. claude.ai/code → repozitorija `teisingumas/DUAIDAI` → nauja sesija nuo `main`.
3. Claude dirba atskiroje šakoje `<vardas>/<aprasymas>` ir atidaro Pull Request.
4. Kitas peržiūri PR ir daro merge į `main`.

Detalios taisyklės – [`CLAUDE.md`](CLAUDE.md).
