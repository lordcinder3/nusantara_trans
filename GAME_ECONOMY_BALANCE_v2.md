# Nusantara Transit Tycoon: Rencana Update Balancing Ekonomi (v2)

Dokumen ini adalah revisi dari `GAME_ECONOMY_BALANCE.md`, dikalibrasi pakai data asli hasil playtest 1 angkot (bukan tebakan). Angka yang masih asumsi ditandai **[ASUMSI]** dan harus dites ulang.

---

## 1. Data Kalibrasi (hasil playtest 1 angkot)

| Data | Nilai | Sumber |
| :--- | :--- | :--- |
| Rute | 2,69 km, tarif Rp 5.000, 12 pnp | Screenshot panel trayek |
| Pendapatan per trip | **Rp 641.256** | = 12 × 5.000 × 8 × (1 + 2,69/8) |
| BBM per trip | ±Rp 3.000 (±0,5% dari pendapatan) | Rincian mutasi kas |
| Jumlah trip (09:00 sampai 00:00, 15 jam game) | 42 trip (504 pax) | Rp 26,9jt ÷ 641.256 |
| Laju trip | ±2,8 trip/jam game, ±50 trip/hari penuh **[ASUMSI]** | Ekstrapolasi, malam lebih sepi |
| Waktu per trip | ±21 menit game | Jauh lebih lama dari teori (4 menit), pakai angka ini |
| Net hari ke-1 | **+Rp 25,9jt** | Laporan tutup buku |
| Fixed cost harian | Rp 270.000 | 1 armada × 120rb + 1 depot × 150rb |
| Load factor | 12/12 terus (mode Ngetem, antrean 25/25) | Demand bukan pembatas |
| Waktu nyata | 1 menit game = 1 detik nyata di 1x; 1 hari = 24 menit di 1x, ±4,8 menit di 5x | Info dari developer |

**Diagnosis:** margin operasional ±98%. Angkot balik modal kurang dari 1 hari game (±2 menit nyata di 5x). Biaya BBM dan biaya tetap tidak berpengaruh karena pendapatan per trip terlalu besar.

## 2. Target Desain

| Armada | Balik modal (hari game) | Di 1x | Di 5x |
| :--- | :---: | :---: | :---: |
| Angkot | ±1 hari | ±24 menit | ±5 menit |
| Metromini | ±2 hari | ±48 menit | ±10 menit |
| BRT | ±3,5 hari | ±84 menit | ±17 menit |

Prinsip: rasio biaya operasional ±17-23% dari pendapatan kotor, ditambah biaya tetap ±10-12% dari net harian, sehingga margin bersih ±65%. Harga beli naik per unit supaya makin lama makin lambat.

---

## 3. Perubahan Parameter (Lama → Baru)

### A. Pendapatan & Biaya Operasional

| Parameter | Lama | Baru |
| :--- | :---: | :---: |
| `FARE_BATCH_MULTIPLIER` | 8 | **4** |
| `opCostPerKm` Angkot | Rp 1.200 | **Rp 20.000** |
| `opCostPerKm` Metromini | Rp 2.200 | **Rp 40.000** |
| `opCostPerKm` BRT | Rp 4.000 | **Rp 90.000** |
| Fixed harian per Angkot | Rp 120.000 | **Rp 1.200.000** |
| Fixed harian per Metromini | Rp 120.000 | **Rp 2.500.000** |
| Fixed harian per BRT | Rp 120.000 | **Rp 4.500.000** |
| Fixed harian per Depot | Rp 150.000 | **Rp 300.000** |
| Harga beli BRT | Rp 95.000.000 | **Rp 145.000.000** |
| Harga beli Angkot / Metromini | Rp 12jt / Rp 35jt | Tetap, tapi naik per unit (lihat 3.C) |
| Ambang tagih BBM | ≥ Rp 2.500 atau 22 menit | **≥ Rp 25.000** (biar log tidak spam) |

Formula biaya tetap baru:

```
FixedDaily = (Σ fixed_per_tipe_armada + JumlahDepotTerbuka × 300.000) × MaintCostMult
           + CicilanBank + RetribusiTrayek
```

### B. Simulasi Hasil (rute 2,69 km, 50 trip/hari)

| | Angkot | Metromini | BRT |
| :--- | :---: | :---: | :---: |
| Pendapatan/trip (load) | Rp 321rb (100%) | Rp 505rb (70%) **[ASUMSI]** | Rp 1,05jt (70%) **[ASUMSI]** |
| BBM/trip | Rp 54rb | Rp 108rb | Rp 242rb |
| Rasio biaya | 17% | 21% | 23% |
| Net/trip | Rp 267rb | Rp 397rb | Rp 806rb |
| Net/hari sebelum fixed | ±Rp 13,3jt | ±Rp 19,9jt | ±Rp 44jt |
| Fixed harian | Rp 1,2jt (+0,3jt depot) | Rp 2,5jt | Rp 4,5jt |
| **Net/hari bersih** | **±Rp 11,8jt** | **±Rp 17jt** | **±Rp 40jt** |
| Balik modal | ±1 hari | ±2 hari | ±3,6 hari |

Catatan: `DistanceBonus` dibatasi 2,5× sedangkan BBM linear terhadap km. Jadi rute sangat panjang otomatis kurang efisien per km, dan itu rem alami yang bagus. Jangan dihapus.

### C. Harga Naik per Unit (anti-snowball)

```
HargaUnitKe-N = HargaDasar × 1.08^(JumlahUnitTipeIni)
```

| Unit ke- | Angkot | Metromini | BRT |
| :---: | :---: | :---: | :---: |
| 1 | Rp 12,0jt | Rp 35,0jt | Rp 145jt |
| 2 | Rp 13,0jt | Rp 37,8jt | Rp 157jt |
| 5 | Rp 16,3jt | Rp 47,6jt | Rp 197jt |
| 10 | Rp 24,0jt | Rp 70,0jt | Rp 290jt |

Refund jual kembali: `HargaBeli × 45% × max(0.3, Kondisi/100)` (dari 60%).

### D. Pajak Progresif PO (retribusi izin trayek, tutup buku 00:00)

```
RetribusiTrayek = JumlahRuteAktif × Rp 1.500.000
                + max(0, JumlahArmada - 8)  × Rp 1.000.000
                + max(0, JumlahArmada - 16) × Rp 1.000.000   // tambahan di atas 16
```

Armada 1-8 bebas retribusi armada, jadi early game aman.

### E. Infrastruktur

| Item | Lama | Baru |
| :--- | :---: | :---: |
| Pasang Halte Lv.1 | Rp 1,5jt | Rp 1,5jt (tetap) |
| Upgrade Lv.2 | Rp 12jt | **Rp 15jt** |
| Upgrade Lv.3 | Rp 45jt | **Rp 65jt** |
| Jalur Busway | Rp 8jt/km | **Rp 12jt/km** |
| Pool Pesing (+10 slot) | Rp 45jt | **Rp 60jt** |
| Pool Cawang (+15 slot) | Rp 75jt | **Rp 100jt** |

Kalau 2 Lv.3 + 2 BRT dihitung untuk kontrak Busway: 2×65 + 2×145 = Rp 420jt. Pastikan pemain baru kebuka ke fase ini setelah ±5-7 hari game.

### F. Pinjaman Bank (bunga naik, maksimal 1 pinjaman aktif)

| Paket | Plafon | Total kembali | Tenor | Cicilan/hari | Bunga |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Kupedes Mikro | Rp 50jt | Rp 62,5jt | 8 hari | Rp 7,8jt | 25% |
| Leasing Armada | Rp 150jt | Rp 195jt | 10 hari | Rp 19,5jt | 30% |
| Obligasi Busway | Rp 350jt | Rp 472,5jt | 12 hari | Rp 39,4jt | 35% |

Cicilan harus selalu lebih kecil dari net harian yang realistis di fase itu, supaya pinjaman terasa risiko tapi bisa diselesaikan.

### G. Kontrak PSO Dishub

| Kontrak | Hadiah lama | Hadiah baru | Syarat lama | Syarat baru |
| :--- | :---: | :---: | :--- | :--- |
| Koneksi Pengumpan | Rp 50jt | **Rp 25jt** | 2 trayek, 150 pax | 2 trayek, **600 pax** |
| Modernisasi Busway | Rp 85jt | **Rp 45jt** | 2 Lv.3 + 2 BRT | Sama |
| Layanan Publik | Rp 60jt | **Rp 30jt** | 200 pax, ojol <35% | **800 pax**, ojol <35% |

Total hibah Rp 100jt (dari Rp 195jt). 150 pax cuma 12 trip (±5 menit nyata di 1x), jadi target pax wajib dinaikkan.

### H. Reputasi

| Level | Threshold lama | Threshold baru | Pengali demand |
| :--- | :---: | :---: | :---: |
| 2 Bos Mikrolet | 80 | **500** | 1,08× |
| 3 Juragan Kopaja | 300 | **2.000** | 1,18× |
| 4 Raja Busway | 700 | **6.000** | 1,28× |
| 5 Konglomerat Transit | 1.500 | **15.000** | 1,40× |

### I. Denda & Safety Net

- Denda razia KIR: `clamp(10% × saldo, Rp 500.000, Rp 3.500.000)`.
- Safety net anti game-over: kalau saldo < Rp 2jt dan tidak ada armada yang jalan, kasih subsidi darurat sekali (Rp 5jt) atau pinjaman otomatis tanpa bunga.
- Starting funds: `zero_25m` tetap Rp 25jt (1 angkot + 3 plang = Rp 16,5jt, sisa Rp 8,5jt cukup nutup 5 hari fixed cost). `sandbox_hubs` Rp 50jt dan `investor_75m` Rp 75jt tetap.

---

## 4. Perbaikan Mekanik

### A. Kurva Elastisitas Tarif (ganti sistem "tangga")

Sekarang: tarif < Rp 4.500 dapat +25%, tarif > Rp 9.000 dapat -45%, di antaranya datar. Akibatnya pemain tinggal pasang Rp 8.500-9.000 di semua rute (+70% pendapatan, tanpa risiko).

```
FareElasticityMult = clamp( (TarifReferensi / Tarif) ^ e , 0.4 , 1.3 )
e = 1.4        // titik awal, tuning dari playtest
TarifReferensi = tarif default tiap tipe armada
```

Tambahan:
- Batas slider tarif turun ke **Rp 2.000 sampai Rp 10.000**.
- Pax yang "kabur ke ojol" naik seiring tarif, jadi tarif tinggi punya konsekuensi nyata di reputasi.
- Catatan jujur: selama antrean halte selalu penuh (demand berlebih), menaikkan tarif tetap menguntungkan sampai demand turun di bawah kapasitas. Tes di bagian 6 untuk memastikan titik optimalnya sekitar 1,3-1,5× tarif default, bukan di batas atas slider.

### B. Rem Demand (kalau test 3 angkot masih full)

Kalau load factor 3 angkot di rute yang sama tetap 12/12, turunkan spawn: pengali global `1.5` di formula `SpawnCount` menjadi `1.0`, atau tambahkan batas antrean dinamis per halte. Demand harus jadi pembatas begitu pemain menumpuk armada di satu rute.

### C. Hail Anywhere (Angkot)

Hail Anywhere bikin halte Lv.1 tidak berguna. Kasih salah satu: pickup rate lebih lambat dari halte, atau tarif efektif ×0,8 untuk penumpang pinggir jalan.

### D. Bug yang harus dicek (`useGameStore.ts` ±baris 2391-2425)

1. Kontrak 1: progres trayek 1/2 tapi bar sudah 100%. Syarat jumlah trayek tidak ikut dihitung.
2. Kontrak 3: rasio ojol 93% (syarat <35%) tapi bar 100%. Syarat rasio ojol tidak ikut dihitung.
3. Pastikan tombol klaim hanya aktif kalau **semua** syarat terpenuhi. Kalau tidak, hadiah bisa terbuka lebih awal.
4. Rasio ojol 93% di awal permainan perlu dicek, apakah wajar atau formulanya terlalu agresif.

---

## 5. Urutan Implementasi

1. Ubah `FARE_BATCH_MULTIPLIER`, `opCostPerKm`, fixed harian, dan ambang tagih BBM (bagian 3.A).
2. Tambahkan **log debug**: net income per kendaraan per hari game, jumlah trip, total pemasukan, total pengeluaran.
3. Playtest 1 hari game penuh dengan 1 angkot, tanpa beli apa pun. Cocokkan dengan target di bagian 6.
4. Terapkan harga naik per unit, pajak PO, harga infrastruktur, refund.
5. Perbaiki bug PSO, naikkan target pax, geser reputasi.
6. Ganti kurva tarif, pasang safety net dan denda proporsional.
7. Playtest 3 angkot di rute yang sama (cek demand), lalu playtest Metromini dan BRT.
8. Terakhir: pinjaman dan hadiah PSO, sesuai income hasil kalibrasi.

---

## 6. Kriteria Lolos Playtest

| Tes | Target | Kalau meleset |
| :--- | :--- | :--- |
| 1 angkot, 1 hari penuh, rute 2,7 km | Net bersih ±Rp 10-13jt | Geser `opCostPerKm` angkot proporsional |
| Balik modal angkot di 5x | 4-6 menit nyata | Geser multiplier atau fixed harian |
| 3 angkot, 1 rute | Load factor turun dari 12/12 | Turunkan spawn (4.B) |
| Metromini | Balik modal ±2 hari game | Geser `opCostPerKm` Metromini |
| BRT | Balik modal ±3-4 hari game | Geser `opCostPerKm` BRT / harga |
| Tarif | Optimal 1,3-1,5× default, bukan di batas slider | Naikkan `e` atau perkuat penalti ojol |
| PSO kontrak 1 | Baru bisa diklaim setelah ±1-2 hari game | Naikkan target pax |
| Sampai armada ke-10 | Pertumbuhan melambat terasa, tidak lompat eksponensial | Naikkan pajak PO atau pengali harga |

## 7. Catatan Asumsi

- Laju ±50 trip/hari diekstrapolasi dari 42 trip (09:00 ke 00:00). Perlu log 1 hari penuh dari 00:00.
- Load Metromini dan BRT 70% adalah tebakan, karena tidak ada mode Ngetem. Ukur ulang di playtest.
- Waktu per trip ±21 menit game (bukan 4 menit sesuai spesifikasi kecepatan) dipakai sebagai acuan. Jangan hitung ekonomi dari kecepatan di tabel armada.
- Hujan (+35% demand) dan jam sibuk ikut mempengaruhi laju. Playtest di kondisi cerah dan hujan.
