# Du Aidai – svetainė

NT projekto „Du Aidai“ (Kaunas, Žaliakalnis, 2027 Q3) svetainė. Du namai (A ir B), 64 butai.
Statinė svetainė: vienas `index.html` (HTML + CSS + JS viename faile) ir nuotraukos `img/` aplanke.
Jokio build žingsnio, jokių priklausomybių.

## Darbo taisyklės (dirba du žmonės)

- `main` šaka visada veikianti. **Niekada nerašyk tiesiai į `main`.**
- Viena užduotis = viena šaka = vienas Pull Request.
  Šakos pavadinimas: `<vardas>/<trumpas-aprasymas>`, pvz. `deivuk/kontaktu-forma`.
- Prieš pradėdamas darbą visada pradėk nuo naujausio `main`.
- Kai darbas baigtas, atidaryk PR į `main` su trumpu aprašymu: kas pakeista ir kaip patikrinti.
- PR peržiūri kitas žmogus, tik tada merge.
- Jei šaka atsilieka nuo `main` arba yra konfliktų, atnaujink ją pagal `main` ir išspręsk konfliktus prieš merge.
- Nedaryk didelių pertvarkymų (failų skaidymo, perrašymo) be atskiro susitarimo – tai sukelia konfliktus kitam žmogui.

## Raktai ir slapti duomenys

- **Repo yra viešas.** Niekada necommit'ink `.env`, API raktų, slaptažodžių ar el. pašto prisijungimų.
- Reikalingų raktų sąrašas yra `.env.example` (tik pavadinimai be reikšmių).
- Reikšmės laikomos Claude Code environment nustatymuose ir hostingo panelėje.

## Dizainas

- Akcentų spalva `#1f4d3a`.
- Hover kortelės: „architektūrinio bloko“ stilius su užimtumo juosta – visur vienodas (aukštai, butai, žemėlapio taškai).
- Nenaudok naršyklės `title` atributo tooltipams (rodo naršyklės kortelę) – naudok `aria-label`.
- Rezervuoti butai turi lengvą oranžinį overlay.
- Telefone: SVG hover neveikia, todėl namų pasirinkimas rodomas sąrašu; atviro meniu žalia – vientisa, ne „burbulas“.

## Kontūrai

Aukštų ir butų kontūrai kuriami atskirame „Kontūrų redaktoriaus“ artifakte ir įklijuojami į `index.html` duomenų sluoksnį.

## Talpinimas

Gyva versija: Hostinger, laikinas domenas `cornflowerblue-bison-370650.hostingersite.com` (`public_html`).
Tame pačiame Hostinger paskyroje yra `vedejasedvardas.lt` – **jo neliesti.**
