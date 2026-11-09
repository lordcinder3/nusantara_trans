# Panduan & Formula Sistem Ekonomi Game Nusantara Transit Tycoon
*(City Transport Manager)*

Dokumen ini memuat seluruh rumusan matematika, parameter harga, biaya operasional, mekanisme pasar penumpang, serta panduan *tuning* untuk menyeimbangkan *pacing* permainan (mengatasi *snowballing* yang terlalu cepat di fase *mid-to-late game*).

---

## 1. Formula Matematika Utama

### A. Pendapatan Penumpang (Trip Revenue)
Setiap kali armada menaikkan penumpang di halte atau di pinggir jalan (*Hail Anywhere*), pemasukan dihitung seketika dengan formula:

$$\text{Pendapatan} = \text{BoardedPax} \times \text{TarifRute} \times \text{FARE\_BATCH\_MULTIPLIER} \times \text{DistanceBonus} \times (1 + \text{JakLingkoBonus})$$

#### Komponen Formula:
1. **`BoardedPax`**: Jumlah penumpang visual yang berhasil naik ke armada (dibatasi oleh sisa kursi kosong armada: $\text{Kapasitas} - \text{PenumpangSaatIni}$).
2. **`TarifRute` (`customFareRp`)**:
   - Angkot Default: **Rp 5.000**
   - Metromini Default: **Rp 4.500**
   - BRT TransJakarta Default: **Rp 3.500**
   - Batas slider fleksibel per rute: **Rp 2.000 s.d. Rp 15.000** (kelipatan Rp 500).
3. **`FARE_BATCH_MULTIPLIER`**: **`8`**
   - Setiap 1 unit penumpang visual mewakili 1 shift armada / rombongan penumpang.
4. **`DistanceBonus`**:
   $$\text{DistanceBonus} = 1 + \min\left(1.5, \frac{\text{PanjangRuteKm}}{8}\right)$$
   - Rute pendek (< 0.5 km) $\rightarrow \approx 1.05\times$
   - Rute sedang (4.0 km) $\rightarrow 1.50\times$
   - Rute panjang ($\ge 8.0$ km) $\rightarrow 2.00\times \text{ s.d. } 2.50\times$
5. **`JakLingkoBonus`**:
   - **`+25%`** ekstra pendapatan jika penumpang yang naik berstatus sebagai **Penumpang Transit/Transfer** antarmoda.

---

### B. Biaya Operasional Variabel (BBM & Jalan)
Dihitung secara kontinu per tick simulasi berdasarkan jarak yang ditempuh kendaraan, kemudian ditagihkan secara diskret setiap kali akumulasi mencapai $\ge \text{Rp } 2.500$ atau waktu berjalan $\ge 22$ menit in-game:

$$\text{BiayaBBMPerStep} = \text{DistanceStepKm} \times \text{opCostPerKm} \times \text{MaintCostMult}$$

- **`opCostPerKm`**:
  - Angkot: **Rp 1.200 / km**
  - Metromini: **Rp 2.200 / km**
  - BRT TransJakarta: **Rp 4.000 / km**
- **`MaintCostMult` (Tingkat Perawatan Bengkel)**:
  - *Hemat / Kanibal Onderdil*: **0.55x** (Biaya BBM/bengkel hemat 45%, namun keausan mesin $0.85\%$ / km)
  - *Standar Bengkel*: **1.00x** (Keausan mesin wajar $0.30\%$ / km, heal $6\%$ di terminal ujung)
  - *Prima Resmi (ATPM)*: **1.65x** (Keausan mesin minimal $0.08\%$ / km, heal $20\%$ di terminal ujung)

---

### C. Biaya Tetap Harian (Fixed OPEX - Tutup Buku 00:00 WIB)
Tiap pergantian hari pukul 00:00 WIB, kas pemain langsung dipotong biaya operasional garasi & bengkel tetap:

$$\text{FixedDailyOverhead} = \left(\text{JumlahArmada} \times \text{Rp } 120.000 + \text{JumlahDepotTerbuka} \times \text{Rp } 150.000\right) \times \text{MaintCostMult}$$

Ditambah dengan **Cicilan Pinjaman Bank Aktif** (jika ada pinjaman berjalan).

---

### D. Biaya Insiden & Denda (Emergency Costs)
1. **Denda Razia KIR Dishub**:
   - Jika kondisi mesin $< 30\%$ dan terjaring razia (probabilitas acak per tick saat speed tinggi): **Rp 3.500.000**.
2. **Servis Overhaul Bengkel Darurat**:
   - Biaya pemulihan kondisi armada: **Rp 650.000 / unit**.

---

### E. Formula Spawn Penumpang di Halte
Penumpang baru muncul di halte setiap $\Delta t \ge 2.5$ menit simulasi:

$$\text{SpawnCount} = \left\lceil \text{BaseWeight} \times \text{ZoneMult} \times \text{FareElasticityMult} \times \text{WeatherMult} \times \text{ReputationMult} \times 1.5 \times (0.85 \sim 1.6) \right\rceil$$

1. **`BaseWeight`**: Ditentukan oleh jenis halte (1.5 s.d. 3.2).
2. **`ZoneMult` (Jam Sibuk / Rush Hour)**:
   - *Pagi (06:15 - 09:30)*: Perumahan $2.6\times$, Kantor $0.8\times$, Pasar $1.5\times$
   - *Siang (09:30 - 16:00)*: Perumahan $1.1\times$, Kantor $1.2\times$, Pasar $2.3\times$
   - *Sore (16:00 - 19:45)*: Perumahan $0.9\times$, Kantor $2.8\times$, Pasar $1.6\times$
   - *Malam (19:45 - 06:15)*: Rata-rata $0.4\times \sim 0.6\times$
3. **`FareElasticityMult` (Elastisitas Tarif)**:
   - Jika tarif $<$ Rp 4.500: Penumpang melonjak hingga $+25\%$.
   - Jika tarif $>$ Ambang toleransi kota (Jakarta Rp 9.000): Penumpang menurun drastis hingga $-45\%$.
4. **`WeatherMult`**: Hujan atau Banjir meningkatkan demand publik $+35\%$.
5. **`ReputationMult`**:
   - Level 1 (Perintis): $1.00\times$
   - Level 2 (Bos Mikrolet, $\ge 80$ pax): $1.08\times$
   - Level 3 (Juragan Kopaja, $\ge 300$ pax): $1.18\times$
   - Level 4 (Raja Busway, $\ge 700$ pax): $1.28\times$
   - Level 5 (Konglomerat Transit, $\ge 1500$ pax): $1.40\times$

---

## 2. Katalog Lengkap Parameter Harga & Biaya (Current Values)

### A. Armada (Fleet Specs)
| Jenis Armada | Model / Subtitle | Kapasitas | Speed | Harga Beli (CAPEX) | Tarif Standar | Biaya BBM/Km (OPEX) | Fitur Spesial |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Angkot Mikrolet** | Suzuki Carry M-15 | 12 org | 38 km/h | **Rp 12.000.000** | Rp 5.000 | Rp 1.200 | Bisa Ngetem, Bisa Angkut Pinggir Jalan (*Hail Anywhere*) |
| **Metromini / Kopaja** | Colt Diesel Bus Sedang | 30 org | 44 km/h | **Rp 35.000.000** | Rp 4.500 | Rp 2.200 | Pengumpan halte level 1/2/3 |
| **BRT TransJakarta** | Scania Articulated | 80 org | 55 km/h | **Rp 95.000.000** | Rp 3.500 | Rp 4.000 | Wajib Halte Lv.3, Dukung Jalur Khusus Busway Anti-Macet |

> **Nilai Jual Kembali (Armada Bekas)**:  
> $\text{Refund} = \text{HargaBeli} \times 60\% \times \max\left(0.3, \frac{\text{Kondisi}}{100}\right)$

---

### B. Infrastruktur & Halte (Stop Tiers)
| Level Halte | Nama | Biaya Upgrade | Antrean Maks | Multiplier Sabar | Dwell Time | Dukung BRT? |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **Lv. 1** | Plang Pinggir Jalan | **Rp 1.500.000** *(Pasang Baru)* | 25 org | $1.0\times$ | $1.0\times$ (1.8s) | ❌ Tidak |
| **Lv. 2** | Halte Beratap | **Rp 12.000.000** | 60 org | $1.4\times$ *(+40%)* | $0.85\times$ (1.53s) | ❌ Tidak |
| **Lv. 3** | Halte BRT Terintegrasi + JPO | **Rp 45.000.000** | 150 org | $1.8\times$ *(+80%)* | $0.50\times$ (0.9s) |  Ya (Wajib) |

- **Jalur Khusus Busway (Dedicated Lane)**: **Rp 8.000.000 / km** (Kebal macet jam sibuk).

---

### C. Pool Garasi & Kapasitas Armada
| Nama Pool | Lokasi / Wilayah | Kapasitas Slot | Biaya Unlock (CAPEX) |
| :--- | :--- | :---: | :---: |
| **Pool Cikini / Manggarai** | Jakarta Pusat | 6 unit | **Rp 0** *(Gratis / Bawaan)* |
| **Pool Pesing - Daan Mogot** | Jakarta Barat & Tangerang | +10 unit (Total 16) | **Rp 45.000.000** |
| **Pool Cawang - Bekasi Raya** | Jakarta Timur & Bekasi | +15 unit (Total 31) | **Rp 75.000.000** |

---

### D. Paket Pinjaman Bank (Bank Loans)
| Paket Pinjaman | Plafon Pinjaman | Total Pengembalian | Cicilan Harian | Tenor | Bunga Total |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Kupedes Mikro** | Rp 50.000.000 | Rp 56.000.000 | Rp 7.000.000 / hari | 8 hari | $12\%$ |
| **Leasing Armada** | Rp 150.000.000 | Rp 170.000.000 | Rp 17.000.000 / hari | 10 hari | $13.3\%$ |
| **Obligasi Busway** | Rp 350.000.000 | Rp 396.000.000 | Rp 33.000.000 / hari | 12 hari | $13.1\%$ |

---

### E. Subsidi Kontrak Dishub (PSO Milestone Rewards)
Begitu target tercapai, dana segar langsung dicairkan ke kas:
1. **Koneksi Pengumpan Komuter** (Buka 2 trayek & angkut 150 pax): **+Rp 50.000.000**
2. **Modernisasi Koridor Busway** (Bangun 2 Halte Lv.3 + 2 unit BRT aktif): **+Rp 85.000.000**
3. **Penghargaan Layanan Publik** (Angkut 200 pax & rasio Ojol $<35\%$): **+Rp 60.000.000**
*Total potensi dana hibah awal:* **Rp 195.000.000**.

---

### F. Mode Awal Permainan (Starting Funds)
- **Rintis dari Nol (`zero_25m`)**: Modal **Rp 25.000.000**, 0 Halte, 0 Armada, 0 Trayek.
- **Konsesi Hub Transit (`sandbox_hubs`)**: Modal **Rp 50.000.000**, halte hub pre-built tersedia.
- **Investor & Kredit (`investor_75m`)**: Modal **Rp 75.000.000** dengan cicilan leasing aktif.

---

## 3. Peta Lokasi Kode Sumber (Code Reference Map)

| Parameter / Logika | File Sumber | Baris Terkait |
| :--- | :--- | :--- |
| `FARE_BATCH_MULTIPLIER` (Pengali Omzet) | `src/store/useGameStore.ts` | Baris ~54 |
| Spesifikasi Armada (Beli, OPEX/km, Kapasitas) | `src/config/fleetSpecs.ts` | Baris 10 - 74 |
| Spesifikasi Halte (Biaya Upgrade, Antrean) | `src/config/fleetSpecs.ts` | Baris 76 - 113 |
| Biaya Jalur Khusus & Denda Razia KIR | `src/config/fleetSpecs.ts` | Baris 194 - 197 |
| Biaya Buka Pool / Depots | `src/config/jakartaPreset.ts` | Baris 221 - 250 |
| Biaya Overhead Harian (Tutup Buku 00:00) | `src/store/useGameStore.ts` | Baris 1545 - 1555 |
| Formula `DistanceBonus` & `JakLingkoBonus` | `src/store/useGameStore.ts` | Baris 1891 - 1902, 2180 - 2191 |
| Formula Keausan Mesin & Denda KIR | `src/store/useGameStore.ts` | Baris 2020 - 2045 |
| Formula Tagihan BBM Variabel | `src/store/useGameStore.ts` | Baris 2008 - 2017, 2280 - 2304 |
| Nilai Hadiah Kontrak Dishub (PSO) | `src/store/useGameStore.ts` | Baris 2391 - 2425 |

---

## 4. Analisa Masalah Snowballing (Penyebab Terlalu Cepat Kaya)

1. **Margin Keuntungan Operasional Mencapai 98%**:
   - Sebagai contoh, 1 unit BRT menempuh jarak 8 km:
     - Biaya BBM per rit: $8\text{ km} \times \text{Rp } 4.000 = \text{Rp } 32.000$.
     - Pendapatan sekali jalan penuh: $80\text{ pnp} \times \text{Rp } 3.500 \times 8 \times 2.0 = \text{Rp } 4.480.000$.
     - **Laba bersih trip = Rp 4.448.000 (Margin 99.3%)**.
2. **Payback Period (ROI) Terlalu Cepat**:
   - Angkot seharga Rp 12.000.000 balik modal hanya dalam **15-18 kali angkut penumpang** (kurang dari 1-2 hari in-game / $\sim 60$ detik waktu bermain nyata).
   - BRT seharga Rp 95.000.000 balik modal hanya dalam **21 kali trip penuh**.
3. **Pemberian Hadiah PSO Terlalu Besar di Awal**:
   - Angkut 150 penumpang langsung dihadiahi Rp 50.000.000 cash. Angka ini setara dengan harga beli 4 unit Angkot baru secara cuma-cuma.
4. **Multiplier Bertumpuk Linier Tanpa Rem Skala Ekonomi**:
   - Tidak ada biaya birokrasi, gaji manajerial kantor pusat, atau pajak progresif saat armada membesar dari 5 menjadi 25 unit.

---

## 5. Panduan Rekomendasi Penyesuaian (Balancing Knobs)

Untuk menjaga fase awal tetap seru namun fase tengah-ke-akhir lebih menantang (*challenging & rewarding*):

```
                       [ REKOMENDASI PENYESUAIAN ]
┌─────────────────────────────┬───────────────────┬───────────────────┐
│ Parameter                   │ Nilai Sekarang    │ Rekomendasi Baru  │
├─────────────────────────────┼───────────────────┼───────────────────┤
│ FARE_BATCH_MULTIPLIER       │ 8                 │ 4 atau Dinamis    │
│ Biaya BBM Angkot / km       │ Rp 1.200          │ Rp 2.500          │
│ Biaya BBM Metromini / km    │ Rp 2.200          │ Rp 5.000          │
│ Biaya BBM BRT / km          │ Rp 4.000          │ Rp 11.000         │
│ Fixed Daily Bengkel/Armada  │ Rp 120.000 / hari │ Rp 450.000 / hari │
│ Hadiah Kontrak 1 (Trayek)   │ Rp 50.000.000     │ Rp 25.000.000     │
│ Hadiah Kontrak 2 (BRT)      │ Rp 85.000.000     │ Rp 45.000.000     │
│ Hadiah Kontrak 3 (Layanan)  │ Rp 60.000.000     │ Rp 30.000.000     │
│ Harga Beli Armada BRT       │ Rp 95.000.000     │ Rp 145.000.000    │
│ Upgrade Halte Lv.3 (BRT)    │ Rp 45.000.000     │ Rp 65.000.000     │
└─────────────────────────────┴───────────────────┴───────────────────┘
```

### Opsi Mekanik "Pajak Progresif PO" (Anti-Snowballing)
Jika ingin lebih realistis, tambahkan biaya retribusi izin trayek bertingkat di `useGameStore.ts` saat pukul 00:00 WIB:
$$\text{RetribusiTrayek} = \text{JumlahRuteAktif} \times \text{Rp } 1.000.000 + (\text{JumlahArmada} > 8 \,?\, (\text{JumlahArmada} - 8) \times \text{Rp } 250.000 : 0)$$
Mekanik ini memaksa pemain terus mengoptimalkan rute dan efisiensi armada daripada sekadar menimbun kendaraan secara membabi buta.
