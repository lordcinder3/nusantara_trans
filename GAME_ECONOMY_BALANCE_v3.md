# Nusantara Transit Tycoon: Rencana Update Balancing Ekonomi (v3)

Revisi dari v2. Perubahan utama: (1) baseline diganti ke hasil hitungan 1 hari penuh (62 trip, Rp 39,3jt/hari), (2) `FARE_BATCH_MULTIPLIER` jadi 5 (bukan 4) karena kurva demand ikut menurunkan pendapatan, (3) kurva demand per jam ditambahkan, (4) `opCostPerKm` dikalibrasi ulang.

Angka bertanda **[ASUMSI]** harus dites ulang lewat log playtest (bagian 8).

---

## 1. Baseline (kondisi game sebelum diubah, 1 angkot, rute 2,69 km)

| Komponen | Nilai |
| :--- | :---: |
| Trip per hari game | ±62 (±23 menit game per trip) |
| Pendapatan per trip | Rp 641.400 (12 pnp × Rp 5.000 × 8 × 1,336) |
| Pendapatan per hari | +Rp 39,76jt |
| BBM per hari | -Rp 0,20jt (Rp 3.228/trip) |
| Fixed harian (angkot Rp 120rb + depot Rp 150rb) | -Rp 0,27jt |
| **Net per hari** | **±Rp 39,3jt** (margin ±98,8%) |
| Balik modal angkot (Rp 12jt) | ±0,3 hari, ±1,5 menit nyata di 5x |
| Load factor | 12/12 sepanjang hari, laju trip sama siang dan malam |

Penyebab: demand dasar jauh di atas kapasitas (antrean 25/25 sepanjang hari, ±8.000 pax lari ke ojol), jadi `ZoneMult` jam sibuk dan sepi tidak berpengaruh ke pendapatan. Biaya hanya ±1,2% dari pendapatan.

## 2. Target Desain

| Armada | Balik modal (hari game) | Di 1x | Di 5x |
| :--- | :---: | :---: | :---: |
| Angkot | ±1-1,3 hari | ±24-31 menit | ±5-6 menit |
| Metromini | ±1,7 hari | ±40 menit | ±8 menit |
| BRT | ±3,2 hari | ±77 menit | ±15 menit |

Prinsip: biaya BBM ±21-26% dari pendapatan, biaya tetap ±10% dari net, margin bersih ±65-70%. Waktu (jam sibuk, siang, malam) harus mengubah pendapatan secara nyata.

---

## 3. Kurva Demand per Waktu (perubahan paling penting, kerjakan duluan)

### A. Masalah di rumus `SpawnCount` sekarang

```
SpawnCount = ceil( BaseWeight × ZoneMult × FareElasticityMult × WeatherMult
                   × ReputationMult × 1.5 × (0.85 ~ 1.6) )
```

- Pengali global `1.5` dan `ceil` membuat spawn tidak pernah turun di bawah 1 per tick, jadi malam pun antrean tetap penuh.
- 1 angkot hanya sanggup mengangkut ±31 pax/jam (12 pnp per ±23 menit), sedangkan 1 halte menghasilkan jauh lebih banyak.

### B. Rumus baru

```
SpawnExpected = BaseWeight × ZoneMult × FareElasticityMult × WeatherMult
                × ReputationMult × SPAWN_GLOBAL_MULT × U(0.85, 1.6)

SpawnCount = floor(SpawnExpected) + (random() < frac(SpawnExpected) ? 1 : 0)
```

- `SPAWN_GLOBAL_MULT`: **0.3** sebagai titik awal (dari 1.5) **[ASUMSI]**. Kalibrasi sampai load siang 1 angkot ±80-85%.
- Ganti `ceil` ke pembulatan probabilistik supaya malam bisa benar-benar sepi (0 penumpang pada sebagian tick).

### C. Tabel `ZoneMult` baru (selisih ekstrem dikecilkan)

| Periode | Perumahan | Kantor | Pasar | Lama |
| :--- | :---: | :---: | :---: | :--- |
| Pagi 06:15-09:30 | 2,0 | 0,7 | 1,3 | 2,6 / 0,8 / 1,5 |
| Siang 09:30-16:00 | 0,9 | 1,0 | 1,8 | 1,1 / 1,2 / 2,3 |
| Sore 16:00-19:45 | 0,8 | 2,0 | 1,3 | 0,9 / 2,8 / 1,6 |
| Malam 19:45-06:15 | 0,3 | 0,2 | 0,2 | 0,4-0,6 |

Rata-rata zona: pagi ±1,3×, siang ±1,2×, sore ±1,4×, malam ±0,25×.

### D. Target load factor 1 angkot (rute 2 halte)

| Periode | Load target | Perilaku yang diharapkan |
| :--- | :---: | :--- |
| Pagi | ±100% | Antrean numpuk, ojol mulai ambil penumpang |
| Siang | ±80-85% | Normal |
| Sore | ±100% | Puncak |
| Malam | ±30-70% | Mode Ngetem nunggu lama (≥70% penuh), trip jarang |

### E. Efek waktu tambahan

1. **Macet jam sibuk:** waktu tempuh ×1,3 di pagi dan sore (nilai awal **[ASUMSI]**). Rute dengan Separator Busway kebal macet. Sekarang header menampilkan "Macet Padat" tapi laju trip tidak berubah.
2. **Cuaca:** hujan +35% demand baru berguna kalau demand tidak jenuh, jadi akan terasa setelah kurva ini dipasang.
3. **Biaya malam (opsional):** tarif lembur sopir atau peluang razia lebih tinggi di malam hari.

---

## 4. Parameter Ekonomi (Lama → Baru)

### A. Pendapatan dan Biaya Operasional

| Parameter | Lama | Baru |
| :--- | :---: | :---: |
| `FARE_BATCH_MULTIPLIER` | 8 | **5** |
| `opCostPerKm` Angkot | Rp 1.200 | **Rp 25.000** |
| `opCostPerKm` Metromini | Rp 2.200 | **Rp 60.000** |
| `opCostPerKm` BRT | Rp 4.000 | **Rp 120.000** |
| Fixed harian per Angkot | Rp 120.000 | **Rp 1.000.000** |
| Fixed harian per Metromini | Rp 120.000 | **Rp 2.500.000** |
| Fixed harian per BRT | Rp 120.000 | **Rp 4.500.000** |
| Fixed harian per Depot | Rp 150.000 | **Rp 300.000** |
| Harga beli BRT | Rp 95jt | **Rp 145jt** |
| Ambang tagih BBM | ≥ Rp 2.500 | **≥ Rp 25.000** |

```
FixedDaily = (Σ fixed_per_tipe_armada + JumlahDepotTerbuka × 300.000) × MaintCostMult
           + CicilanBank + RetribusiTrayek
```

### B. Proyeksi setelah perubahan (rute 2,69 km)

Pendapatan per trip penuh: Angkot Rp 401rb, Metromini Rp 902rb, BRT Rp 1,87jt (tarif default × 5 × 1,336).

| | Angkot | Metromini | BRT |
| :--- | :---: | :---: | :---: |
| Trip/hari | ±40 | ±50 **[ASUMSI]** | ±50 **[ASUMSI]** |
| Load rata-rata | ±95% (setara ±38 trip penuh) | 70% **[ASUMSI]** | 70% **[ASUMSI]** |
| Pendapatan kotor/hari | ±Rp 15,2jt | ±Rp 31,6jt | ±Rp 65,5jt |
| BBM/hari | Rp 2,7jt (±18%) | Rp 8,1jt (±26%) | Rp 16,1jt (±25%) |
| Fixed/hari | Rp 1,3jt (+depot) | Rp 2,5jt | Rp 4,5jt |
| **Net/hari bersih** | **±Rp 11,2jt** | **±Rp 21jt** | **±Rp 45jt** |
| Balik modal | ±1,1 hari | ±1,7 hari | ±3,2 hari |

Catatan: `DistanceBonus` dibatasi 2,5× sedangkan BBM linear terhadap km, jadi rute sangat panjang otomatis kurang efisien per km. Ini rem alami yang bagus, jangan dihapus.

### C. Harga Naik per Unit

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

### D. Pajak Progresif PO (tutup buku 00:00)

```
RetribusiTrayek = JumlahRuteAktif × Rp 1.500.000
                + max(0, JumlahArmada - 8)  × Rp 1.000.000
                + max(0, JumlahArmada - 16) × Rp 1.000.000
```

### E. Infrastruktur

| Item | Lama | Baru |
| :--- | :---: | :---: |
| Pasang Halte Lv.1 | Rp 1,5jt | Rp 1,5jt |
| Upgrade Lv.2 | Rp 12jt | **Rp 15jt** |
| Upgrade Lv.3 | Rp 45jt | **Rp 65jt** |
| Jalur Busway | Rp 8jt/km | **Rp 12jt/km** |
| Separator Busway (per rute) | Rp 21,5jt | **Rp 30jt** (setelah macet berpengaruh) |
| Pool Pesing (+10 slot) | Rp 45jt | **Rp 60jt** |
| Pool Cawang (+15 slot) | Rp 75jt | **Rp 100jt** |

### F. Pinjaman Bank (maksimal 1 pinjaman aktif)

| Paket | Plafon | Total kembali | Tenor | Cicilan/hari | Bunga |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Kupedes Mikro | Rp 50jt | Rp 62,5jt | 8 hari | Rp 7,8jt | 25% |
| Leasing Armada | Rp 150jt | Rp 195jt | 10 hari | Rp 19,5jt | 30% |
| Obligasi Busway | Rp 350jt | Rp 472,5jt | 12 hari | Rp 39,4jt | 35% |

Cek: cicilan Kupedes Rp 7,8jt lebih kecil dari net 1 angkot Rp 11jt, jadi aman tapi terasa.

### G. Kontrak PSO Dishub

1 angkot ≈ 450-500 pax/hari setelah kurva demand dipasang.

| Kontrak | Hadiah lama | Hadiah baru | Syarat baru |
| :--- | :---: | :---: | :--- |
| Koneksi Pengumpan | Rp 50jt | **Rp 25jt** | 2 trayek, **1.000 pax** |
| Modernisasi Busway | Rp 85jt | **Rp 45jt** | 2 Lv.3 + 2 BRT aktif |
| Layanan Publik | Rp 60jt | **Rp 30jt** | **1.500 pax**, ojol <35% |

Total hibah Rp 100jt (dari Rp 195jt).

### H. Reputasi (dikalibrasi ke ±480 pax/hari per angkot)

| Level | Lama | Baru | Pengali demand |
| :--- | :---: | :---: | :---: |
| 2 Bos Mikrolet | 80 | **1.000** | 1,08× |
| 3 Juragan Kopaja | 300 | **6.000** | 1,18× |
| 4 Raja Busway | 700 | **25.000** | 1,28× |
| 5 Konglomerat Transit | 1.500 | **80.000** | 1,40× |

Pengali ini baru terasa setelah demand tidak jenuh. Tambahkan reward non-demand: buka armada tertentu, diskon pinjaman, atau batas tarif lebih tinggi.

### I. Denda, Perawatan, dan Safety Net

- Denda razia KIR: `clamp(10% × saldo, Rp 500.000, Rp 3.500.000)`.
- Overhaul bengkel darurat: Rp 650.000 → **Rp 1,5jt/unit** (Rp 650rb tidak terasa terhadap net Rp 11jt/hari).
- Safety net: kalau saldo < Rp 2jt dan tidak ada armada jalan, beri subsidi darurat sekali (Rp 5jt) atau pinjaman otomatis tanpa bunga.
- Starting funds: `zero_25m` tetap Rp 25jt (1 angkot + 3 plang = Rp 16,5jt, sisa Rp 8,5jt cukup menutup ±6 hari fixed cost).

---

## 5. Perbaikan Mekanik

### A. Keausan mesin tidak punya trade-off

Di screenshot, mesin tetap 100% setelah 172 km. Rute 2,69 km ≈ 0,8% keausan per leg (0,3%/km), sedangkan heal 6% tiap sampai terminal, jadi mesin tidak pernah turun. Dengan ±50 arrival/hari, heal 6% = 300% per hari.

Nilai awal yang disarankan **[ASUMSI]**:

| Tingkat | Keausan/km | Heal per sampai terminal | Perkiraan kondisi/hari |
| :--- | :---: | :---: | :---: |
| Hemat (0,55×) | 0,45% | 0% | ±-60% |
| Standar (1,0×) | 0,30% | 0,4% | ±-20% |
| Prima (1,65×) | 0,08% | 0,2% | ±0% (stabil) |

Dengan ini razia KIR (mesin <30%) dan Servis Overhaul jadi relevan.

### B. Kurva Elastisitas Tarif

```
FareElasticityMult = clamp( (TarifReferensi / Tarif) ^ e , 0.4 , 1.3 )
e = 1.4                      // titik awal, tuning dari playtest
TarifReferensi = tarif default tiap tipe armada
```

- Slider tarif: **Rp 2.000 sampai Rp 10.000**.
- Pax yang kabur ke ojol naik seiring tarif.
- Setelah demand tidak jenuh (bagian 3), kurva ini baru bermakna: tarif tinggi akan menurunkan load, jadi ada titik optimal. Target optimal ±1,3-1,5× tarif default, bukan di batas slider.

### C. Hail Anywhere (Angkot)

Hail Anywhere membuat halte Lv.1 tidak berguna. Beri penalti: pickup rate lebih lambat, atau tarif efektif ×0,8 untuk penumpang pinggir jalan.

### D. UI dan Informasi

1. Label "Laba" di panel trayek saat ini hanya setoran dikurangi BBM. Ganti jadi **laba bersih setelah fixed cost**, plus net per hari dan estimasi sisa waktu balik modal per armada.
2. Pax yang kabur ke ojol tampilkan sebagai **"demand belum terlayani" per halte**, sebagai sinyal ke pemain untuk menambah armada.

### E. Bug kontrak PSO (`useGameStore.ts` ±baris 2391-2425)

1. Kontrak 1: progres trayek 1/2 tapi bar 100%.
2. Kontrak 3: rasio ojol 93% (syarat <35%) tapi bar 100%.
3. Tombol klaim hanya boleh aktif kalau **semua** syarat terpenuhi.
4. Cek apakah rasio ojol 93% di awal permainan wajar (kemungkinan membaik setelah demand diturunkan).

### F. Waktu per trip

Trip 2,69 km memakan ±23 menit game, padahal teori ±4 menit di 38 km/h. Cek apakah itu disengaja (dwell, ngetem, macet). Kalau diperbaiki nanti, seluruh kalibrasi di dokumen ini harus diulang.

---

## 6. Urutan Implementasi (urutan ini penting)

1. **Log debug** (bagian 8) dipasang dulu, supaya setiap langkah bisa diukur.
2. **Kurva demand** (bagian 3): `SPAWN_GLOBAL_MULT`, pembulatan probabilistik, tabel `ZoneMult`, macet jam sibuk. Playtest 1 hari, cek load per periode.
3. Ubah `FARE_BATCH_MULTIPLIER` ke 5, `opCostPerKm`, fixed harian, ambang tagih BBM.
4. Playtest 1 angkot 1 hari penuh, bandingkan ke tabel 4.B.
5. Harga naik per unit, pajak PO, infrastruktur, refund.
6. Perbaiki bug PSO, ubah target pax dan threshold reputasi.
7. Mesin/perawatan, kurva tarif, safety net, denda proporsional.
8. Playtest 3 angkot satu rute, lalu Metromini dan BRT.
9. Terakhir: pinjaman dan hadiah PSO sesuai income hasil kalibrasi.

Kalau urutan 2 dan 3 dibalik, net akan terlihat ±Rp 16jt (load masih 100%) dan `opCostPerKm` akan dikalibrasi terlalu rendah.

---

## 7. Kriteria Lolos Playtest

| Tes | Target | Kalau meleset |
| :--- | :--- | :--- |
| Load per periode, 1 angkot | Pagi/sore ±100%, siang ±80-85%, malam ±30-70% | Atur `SPAWN_GLOBAL_MULT`: siang >90% turunkan 15%, <75% naikkan 15% |
| Trip count per periode | Beda jelas antar periode (malam paling sedikit) | Cek ngetem dan macet |
| Net/hari 1 angkot | **±Rp 10-13jt** | >Rp 15jt: demand masih jenuh. <Rp 8jt: turunkan `opCostPerKm` dulu |
| Balik modal angkot di 5x | 4,5-6,5 menit nyata | Geser multiplier atau fixed |
| 3 angkot, 1 rute | Load turun dari 12/12, ojol berkurang | Turunkan spawn lagi |
| Metromini | Balik modal ±1,7 hari | Geser `opCostPerKm` Metromini |
| BRT | Balik modal ±3-3,5 hari | Geser `opCostPerKm` / harga BRT |
| Tarif | Optimal ±1,3-1,5× default | Naikkan `e` atau penalti ojol |
| Mesin | Standar turun ±20%/hari | Geser keausan atau heal |
| Armada ke-10 | Pertumbuhan melambat terasa | Naikkan pajak PO atau pengali harga |

## 8. Log Debug yang Dibutuhkan

Per hari game dan per periode (pagi/siang/sore/malam):
- pax spawn, pax terangkut, pax ke ojol
- load factor rata-rata dan jumlah trip
- pendapatan, BBM, fixed, net per armada
- kondisi mesin awal dan akhir hari

Kirim hasil log 1 hari penuh (mulai 00:00) supaya angka bisa dikalibrasi ulang.

## 9. Catatan Asumsi

- Load Metromini dan BRT (70%) belum diukur.
- Nilai `SPAWN_GLOBAL_MULT = 0.3`, faktor macet ×1,3, dan angka keausan mesin hanya titik awal.
- Proyeksi angkot ±40 trip/hari berasal dari estimasi per periode, bukan dari data. Data asli baru ada untuk kondisi sebelum perubahan (62 trip).
- Cuaca hujan (+35% demand) dan hari-hari berbeda belum diukur terpisah.
