# 🚌 Nusantara Transit Manager — Master Project Plan & Roadmap (v3)

Dokumen ini adalah acuan resmi arsitektur teknis, status pengerjaan, dan *master plan* game **Nusantara Transit Manager**, mencakup rekapitulasi **Phase 1 s/d Phase 4 (Selesai)**, solusi mendesak **Rebalance Rumus Ekonomi (Pacing Modal Rp 25 Juta)**, serta **Roadmap Masa Depan: QOL & Mekanik Immersive (Phase 5)**.

---

## 🛠️ Tech Stack & Arsitektur Inti
- **Frontend & UI:** Vite + React 18 + TypeScript + Tailwind CSS + Lucide Icons
- **Geospatial & 3D Map Engine:** `maplibre-gl` (2.5D/3D `fill-extrusion` dengan proyeksi permukaan datar *flat-earth trigonometry*) + `@turf/turf` (`along`, `distance`, `bearing`, `circle`, `lineString`)
- **Routing Engine (3-Tier Hybrid):**
  1. `localStorage` Geometry Cache (`0ms` untuk segmen halte yang sudah pernah dihitung)
  2. Live OSRM Public API (`router.project-osrm.org` mengikuti jalan asli)
  3. Client-side Dijkstra Offline Road Graph ([offlineRoadGraph.ts](file:///d:/Antigrav/City_Transport/src/services/offlineRoadGraph.ts)) untuk *fallback* instan bebas *rate-limit*
- **State & 60fps Game Loop:** `zustand` ([useGameStore.ts](file:///d:/Antigrav/City_Transport/src/store/useGameStore.ts)) + `requestAnimationFrame` delta-time loop ([useGameLoop.ts](file:///d:/Antigrav/City_Transport/src/hooks/useGameLoop.ts)) dengan *multi-frequency GeoJSON source sync* (tanpa membebani React re-render per frame).
- **Custom Agent Skill:** [SKILL.md](file:///d:/Antigrav/City_Transport/.agents/skills/gis-transit-tycoon-architect/SKILL.md) (`gis-transit-tycoon-architect`).

---

## ✅ Rekap Fitur yang SUDAH Selesai (Phase 1 – Phase 4)

### 🟢 PHASE 1: Core GIS Engine, 3D Low-Poly Map, Road-Snapped Trayek & Pergerakan Armada
- **Peta 3D/2D Real-World Jakarta ([MapCanvas.tsx](file:///d:/Antigrav/City_Transport/src/components/map/MapCanvas.tsx)):** Pitch 42° dan 2D top-down, siklus Siang/Senja/Malam otomatis & override manual, filter gedung tinggi (>= 22m), klaster 3D POI Landmark (Stasiun, Pasar, Monas, Sarinah, RSCM).
- **3 Kasta Armada Khas Indonesia ([fleetSpecs.ts](file:///d:/Antigrav/City_Transport/src/config/fleetSpecs.ts)):** Angkot Mikrolet (12 pax, Ngetem & Hail Anywhere), Metromini/Kopaja (30 pax), TransJakarta BRT (80 pax, Busway).
- **Kompetitor Ojol:** Timer kesabaran penumpang; jika terlambat, kabur naik Ojol dan tercatat di meteran *Diambil Ojol*.

### 🟢 PHASE 2: Radius Cakupan Halte, Bangunan OSM, Offline Routing & Sistem Oper JakLingko
- **Radius Cakupan Halte (Catchment Area):** `@turf/circle` 300m untuk halte biasa, 500m untuk Hub/BRT.
- **Live Placement Preview di Kursor:** Ghost circle dengan tooltip calon nama wilayah, hitungan bangunan OSM di sekitar via `queryRenderedFeatures`, dan potensi demand.
- **Offline Dijkstra Routing Fallback:** Penarikan rute instan tanpa limit kuota OSRM.
- **Sistem Titik Oper / Transit JakLingko:** Deteksi otomatis konektor jalan kaki (<250m) antar-trayek dengan bonus tiket integrasi **+25%**.

### 🟢 PHASE 3 & 3.5: Deep Tycoon Economy, Upgrade Halte 3D, Pool Garasi & UI Overhaul
- **Penamaan Halte Otomatis Wilayah:** 90+ centroid kelurahan/wilayah Jabodetabek.
- **3 Tingkatan Halte:** Lv.1 Plang Jalan (20 pax) $\rightarrow$ Lv.2 Beratap (50 pax) $\rightarrow$ Lv.3 BRT + JPO (150 pax + syarat wajib TransJakarta).
- **Pool Garasi & KIR Dishub:** Pool Cikini, Pesing, Cawang, Kramat Jati, Depok, Bekasi; mekanik mogok mesin (<30%) dan tilang KIR Dishub Rp 3,5 Jt.
- **Stok Pool vs Armada Aktif:** Pemisahan `IDLE_IN_POOL` (Rp 0 BBM, memulihkan mesin) vs `ACTIVE` di jalan.
- **Pop-up Arus Kas Diskrit:** Visual float `+Rp` hijau (setoran tiket) dan `-Rp` merah (BBM, bengkel, belanja).
- **Tata Letak Bersih:** Collapsible Left Panel ([SideDock.tsx](file:///d:/Antigrav/City_Transport/src/components/hud/SideDock.tsx)), Bottom Command Dock ([BottomCommandDock.tsx](file:///d:/Antigrav/City_Transport/src/components/hud/BottomCommandDock.tsx)), dan Modals.

### 🟢 PHASE 4 & 4.5: Megapolitan Jabodetabek, Rintis dari Nol (Rp 25 Jt), Visual Polish & Optimalisasi Bangunan (Opsi A)
- **Perluasan Peta Jabodetabek:** Bounding box luas `[[106.48, -6.68], [107.22, -6.05]]` (Tangerang/Bandara Soetta/BSD s/d Bekasi/Cikarang & Bogor).
- **Mode Rintis PO dari Nol (Rp 25 Juta):** Start 0 Halte, 0 Trayek, 0 Armada dengan panduan 3 langkah di panel kiri.
- **Neraca CAPEX vs OPEX & Tutup Buku Harian (00:00 WIB):** Valuasi likuidasi armada (`60% × harga beli × % kondisi`), badge profitabilitas trayek `🟢 Laba` / `🔴 Boncos`, dan `dailyLedger`.
- **Cuaca Dinamis & Banjir:** `☀️ Cerah`, `🌧️ Hujan Deras` (pax +35%, tapi halte Lv.1 tanpa atap bocor 2x lebih cepat), dan `🌊 Banjir` (laju -55%, aus mesin 2.2x).
- **Ekspansi Multi-Kota & Isolated Auto-Save:** Jabodetabek, Bandung Raya (+15% speed Angkot), Surabaya (+12% speed bus), Bali (toleransi tarif turis lebih tinggi) dengan slot `localStorage` independen per kota.
- **Optimalisasi Visual Opsi A (Eliminasi 17.000+ Kotak Pemukiman 2D):** Sembunyikan layer 2D poligon rumah warga kecil (`building` & `building-top`) yang sebelumnya membebani GPU dengan >100.000 vertex. Hasil: 60 FPS stabil, peta super lega, dan hanya gedung-gedung besar / POI bernilai demand tinggi yang ditonjolkan dalam 3D berwarna (Kantor: Biru Modern, Pasar/Mall: Amber, Stasiun: Hijau Tosca, Landmark: Ungu).
- **High-Contrast Night Labels & Custom Grab Cursor:** Teks peta malam putih cerah halo hitam pekat (`#f8fafc` + `#020617`), jembatan layang malam tanpa silau putih, serta kursor geser tangan custom transit cyan `#38bdf8` tebal 2.6px. Modal dialog diperlebar ke `max-w-6xl` dengan click-outside-to-close.

---

## ⚡ PRIORITAS URGENT: Rebalance Rumus Ekonomi (Solusi "Progres Terlalu Lama")

### Masalah Saat Ini
Modal awal Rp 25 Jt habis untuk 2 Halte (Rp 5 Jt) + 1 Angkot (Rp 15 Jt) = Sisa Rp 5 Jt.
Setoran 1 rit Angkot hanya menghasilkan ~Rp 120.000 (setelah dipotong BBM), sehingga butuh **>80 rit (27 menit nonstop di 5x speed)** hanya untuk membeli Angkot ke-2.

### Rumus & Pacing Baru (Target Balik Modal 1–2 Menit di 5x Speed)

#### 1. Penyesuaian Harga Awal (CAPEX)
| Item | Harga Lama | **Harga Baru** | Kapasitas | Setoran / Rit (Est. 4 km) | Target ROI |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **🪧 Halte Lv.1 (Plang)** | Rp 2.500.000 | **Rp 1.500.000** | 25 pax | — | Buka rute awal sangat murah |
| **🚐 Angkot Mikrolet** | Rp 15.000.000 | **Rp 12.000.000** | 12 pax | **~Rp 720.000** | **~16 Rit (1–2 Menit di 5x)** |
| **🚏 Upgrade Halte Lv.2** | Rp 18.000.000 | **Rp 12.000.000** | 60 pax | — | Perlindungan dari hujan |
| **🚌 Metromini / Kopaja** | Rp 45.000.000 | **Rp 35.000.000** | 30 pax | **~Rp 1.620.000** | **~21 Rit** |
| **🚍 TransJakarta BRT** | Rp 120.000.000 | **Rp 95.000.000** | 80 pax | **~Rp 3.360.000** | **~28 Rit** |
| **🌉 Upgrade Halte Lv.3 (JPO)** | Rp 65.000.000 | **Rp 45.000.000** | 150 pax | — | Koridor busway |

> **Kondisi Menit ke-0 Baru:**
> Pasang 2 Halte (`Rp 3 Jt`) + Beli 1 Angkot (`Rp 12 Jt`) = **Sisa Kas Rp 10.000.000**!
> Pemain hanya butuh menabung laba bersih **Rp 2.000.000** lagi untuk membeli **Angkot ke-2**!

#### 2. Rumus Pendapatan Setoran Berbasis Jarak
$$\text{Setoran} = \text{Pax Boarded} \times \text{Tarif} \times \mathbf{8}_{\text{(Multiplier Komuter)}} \times \left(1 + \min\left(1.5, \frac{\text{Jarak Trayek KM}}{8}\right)\right)$$

#### 3. Penyesuaian Laju Penumpang, Kecepatan Visual & Servis
- **Spawn Interval:** Penumpang halte muncul setiap **2.5 menit game** (sebelumnya 4.0 mnt) dengan volume **+50%**.
- **Kecepatan Visual Armada:** Pengali gerak dinaikkan dari `14` $\rightarrow$ **`19`**, waktu ngetem maks dipersingkat dari `14s` $\rightarrow$ **`8s`**.
- **Biaya Overhaul Bengkel:** Diturunkan dari Rp 1,5 Jt $\rightarrow$ **Rp 650.000**, laju keausan mesin wajar di **`0.30% / km`** (sebelumnya 0.65%/km).

---

## 🎨 MASTER PLAN UI/UX OVERHAUL (Target Redesign 2026)

Berdasarkan blueprint UI/UX terverifikasi, berikut adalah arsitektur tata letak antarmuka baru untuk memecahkan masalah *cluttering* dan meningkatkan keterbacaan data tycoon secara instan:

### 1. Header & TopBar Minimalis
- **Profil Perusahaan & Finansial:**
  - Badge PO: `PO Nusantara Jaya • Lv.1 Perintis`
  - Kas Utama: Format nominal ringkas (contoh: `KAS: Rp 21,9 jt`)
  - **Prakiraan Arus Kas 00:00:** Indikator estimasi beban biaya harian (contoh: `Tagihan tutup buku 00:00: -Rp 1,3 jt`) agar pemain terhindar dari kebangkrutan mendadak.
- **Kontrol Waktu & Fitur Lewati Malam:**
  - Jam Besar (`07:45`) + Hari & Periode (`Hari 1 • Pagi`).
  - Speed Pills (`Pause`, `1x`, `2x`, `5x`).
  - Tombol QoL **`[ Lewati malam ]`**: Mempercepat / melompati waktu sepi penumpang (22:00–05:00) langsung menuju subuh (05:30) dan menyelesaikan tutup buku secara instan.
- **Status Rush Hour & Menu:**
  - Pill indikator dinamis: `Rush Hour Pagi: Demand ×1,3 • Macet ×1,3` + `Terangkut: 0 pax`.
  - Tombol Hamburger `Menu` untuk memindahkan kontrol sekunder (kamera 2D/3D, cuaca, gedung 3D, setting).

### 2. Widget Tengah Atas: DEMAND 24 JAM (Interactive Waveform)
- Grafik kurva lonceng 24 jam interaktif (dua puncak: Rush Hour Pagi 07:00–09:00 dan Rush Hour Sore 16:00–19:30).
- Jarum playhead vertikal kuning dinamis yang bergerak mengikuti waktu jam saat ini (`gameMinutes`).
- Teks countdown prediktif: *"Puncak sore 16:00, 8j 15m lagi"* untuk memberi pemain waktu mempersiapkan armada.

### 3. Dekomposisi Panel Kiri (Floating Cards)
- **Card 1: Pinned Onboarding Checklist (Mulai Rintis, 3 Langkah):**
  - Tetap melayang rapi di kiri atas: `✓ 1. Pasang 2 halte`, `✓ 2. Tarik trayek`, `● 3. Beli angkot pertama (Rp 12 jt)`.
  - Memberi panduan tanpa memakan ruang vertikal penuh.
- **Card 2: Focused Route Inspector (T-01):**
  - Header: Nama Trayek, Jarak (km), Jumlah Halte, dan Jumlah Armada Aktif.
  - **Matrix KPI 2×2:** *Load rata-rata*, *Net per hari*, *Balik modal*, *Belum terlayani (pax)* dengan alert warna merah jika ada antrean menumpuk.
  - Pengatur Tarif Tiket (dengan indikator elastisitas penumpang vs Ojol).
  - Toggle Switch *Mode Ngetem (Tunggu ≥70% penuh sebelum berangkat)*.
  - Tombol Aksi Utama: **`[ Beli armada untuk trayek ini ]`** untuk pintasan langsung ke dealer/alokasi rute.

### 4. In-World Map Callouts (Peta Interaktif)
- Callout mengambang di atas halte bermasalah: `Plang Sungai Gresik 25/25` (*15 pax kabur ke ojol. Layani halte ini dengan armada*).
- Guide bubble kontekstual: *"Langkah 3: beli angkot pertama"* yang mengarahkan fokus pemain ke tombol di dock bawah.

### 5. Ergonomic Bottom Command Dock
- Navigasi 6 ikon bersih dan ringkas:
  1. `[ 📍 Halte ]` (Buka mode pasang halte & daftar halte)
  2. `[ 🚌 Armada ]` (Modal daftar armada aktif & kelola servis)
  3. `[ 🏢 Dealer ]` (Showroom beli armada baru / bekas)
  4. `[ 🏠 Garasi ]` (Pool armada & fasilitas perawatan)
  5. `[ 💵 Keuangan ]` (Laporan laba/rugi harian, hutang bank, dan kontrak Dishub dengan badge notifikasi `1`)
  6. `[ 🌐 Kota ]` (Pilihan kota Jabodetabek, Bandung, Surabaya, Bali)

### 6. Benchmark Visual Game Lain (Studi Kasus *City Bus Manager / Ulm*) & Guardrail Performa Web
Berdasarkan telaah komparasi game transit desktop (*City Bus Manager*):
1. **Multi-Line Ribbon Offset (Wajib Diadopsi):**
   - Jalur bus yang berbagi segmen jalan sama dirender sejajar berdampingan (multi-color parallel ribbons).
   - **Teknik Eksekusi WebGL:** Gunakan native shader property `line-offset` MapLibre GL. CPU cost 0 ms (dihitung langsung di GPU vertex shader).
2. **Dense Station Pins & Floating Badges:**
   - Pin "H" dan badge numerik (kamera turis, smiley kepuasan, koneksi stasiun) **wajib 100% menggunakan MapLibre WebGL Symbol Layer / SDF Icons** (DILARANG menggunakan DOM HTML Markers untuk menghindari *forced layout reflow*).
3. **Culling Ekstrusi Gedung 3D:**
   - Mempertahankan filter selektif (hanya POI bernilai demand tinggi & gedung >= 28m) agar GPU web tidak kelebihan beban vertex di kota padat seperti Jabodetabek.

---

## 🔮 ROADMAP MASA DEPAN: QOL & Mekanik Immersive (Phase 5)

Berikut adalah daftar fitur Quality of Life (QOL) dan mekanik realistis yang dijadwalkan:

### 1. Visual & UI QOL (Low-Cost, High-Impact)
1. **Traffic Heatmap Overlay Toggle:**
   - Tombol sakelar di HUD untuk mengubah visualisasi jalur koridor peta secara real-time berdasarkan kecepatan armada:
     - 🟢 **Hijau Neon:** Lancar Jaya ($\ge 80\%$ kecepatan maks).
     - 🟡 **Kuning:** Padat Merayap ($50\% - 79\%$).
     - 🔴 **Merah:** Macet Total / Bottleneck / Titik Banjir ($< 50\%$).
2. **Ghost Line Route Preview:**
   - Garis pratinjau transparan melengkung mengikuti geometri jalan asli (OSRM/Offline Graph) saat pemain menghubungkan halte di mode `+ Tarik Trayek`, lengkap dengan estimasi jarak (km) dan perkiraan waktu tempuh.
3. **Actionable Alert Banner (Ticker):**
   - Bar notifikasi berjalan di bawah TopBar untuk *event kritis* (Halte overload 25/25, armada mogok di jalan, atau razia KIR Dishub).
   - **Interaktif:** Klik banner langsung melakukan `map.flyTo` ke lokasi kejadian secara instan.
4. **Line Profitability Dashboard:**
   - Visualisasi mendalam per trayek di panel kiri dan laporan keuangan mingguan/harian.
5. **Low-Poly Tiered 3D Vehicle Models (Selesai):**
   - **Angkot Mikrolet:** Bentuk minivan berundak dengan moncong kap mesin depan, bodi biru telur asin, kaca depan miring, dan atap putih khas mikrolet.
   - **Metromini / Kopaja:** Bodi bus sedang oranye/hijau dengan pita kaca jendela melingkar hitam dan atap krem/putih gading ikonik.
   - **TransJakarta BRT:** Bus panjang high-deck bodi biru elektrik, kaca panoramik hitam modern, atap putih aerodinamis, dan **pod AC ganda (rooftop AC units)** di atas atap persis game transit modern.
   - Dihitung seketika via *flat-earth local translation trigonometry* (0 KB file eksternal, 100% WebGL `fill-extrusion`, 60 FPS).

### 2. Simulasi Penumpang Realistis (Origin-Destination & Crowding Matrix)
1. **Real Destinations (OD Matrix):**
   - Penumpang yang *spawn* di titik perumahan memiliki target destinasi riil (Kantor CBD, Pasar Niaga, Stasiun KRL).
   - Memberikan bonus tarif **+15% (Ketepatan Rute)** jika trayek langsung mengantar sampai tujuan, atau mengaktifkan transfer JakLingko (**+25% bonus**) jika melewati halte transit.
2. **Wait Times & In-Cabin Travel Times:**
   - Penalti kepuasan dan risiko kabur ke Ojol dinilai dari dua faktor: waktu antre di halte dan durasi perjalanan di dalam kabin (diperparah jika terjebak macet tanpa jalur busway).
3. **Incremental Boarding Speed & Chokepoint:**
   - Halte Lv.1 memiliki laju naik-turun lambat (1 pax/detik).
   - Halte Lv.2 beratap lebih cepat (2 pax/detik).
   - Halte Lv.3 BRT + JPO super cepat (4 pax/detik, 2 pintu).
4. **Komplain Satir Warga (+62 Twitter/X Feeds):**
   - Kartu toast cuitan media sosial warga lokal yang memancing senyum sekaligus memberi tahu pemain apa yang salah:
     - *"@juragan_trans bus M-01 ngetem di Cikini dari jaman batu sampe skrg belom jalan juga, keburu resign gue 😭"*
     - *"Halte plang doang gaada atap, ujan deres begini auto pesen ojol ajalah gamau masuk angin 🛵🌧️"*
     - *"Tarif angkot 8 rebu mending naik ojol ada promo diskon 50% woy juragan maruk amat 💸"*

### 3. Audio Atmosferik WebAudio & Event Spesial Perkotaan
- Sound effects sintetis (WebAudio API, 0 KB file asset): Bunyi koin kasir saat setoran masuk, klakson bus, sirene Dishub, dan tombol Mute.
- Random Events: Car Free Day (CFD) Minggu Pagi, Pasar Tumpah, dan Promo Bakar Duit Ojol.

---

## 🎯 Urutan Eksekusi Tindakan Berikutnya
1. **Langkah 1 (SEGERA):** Eksekusi perubahan kode untuk **Rebalance Rumus Ekonomi** di [useGameStore.ts](file:///d:/Antigrav/City_Transport/src/store/useGameStore.ts) dan [fleetSpecs.ts](file:///d:/Antigrav/City_Transport/src/config/fleetSpecs.ts) agar progres modal Rp 25 Jt terasa responsif dan *rewarding*.
2. **Langkah 2:** Implementasi **Actionable Alert Ticker** & **Komplain Satir Warga (+62 Feeds)**.
3. **Langkah 3:** Implementasi **Traffic Heatmap Overlay Toggle** & **Ghost Line Route Preview**.
