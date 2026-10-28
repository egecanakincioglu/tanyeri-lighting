# Yol Haritası

> Vizyon: [vision.md](vision.md) · Ayrıntılı adımlar: [revizyon planı](plans/2026-10-27-revizyon.md) · Kararlar: [adr/](adr/README.md) · Günlük: [journal/](journal/README.md)

## Mevcut durum

- **Faz:** Faz 3 tamamlandı (v0.1.0, 2026-10-28); Faz 4 (sunucu temeli) başlıyor. Canlı: https://tanyeri-lighting.vercel.app — 1.0.0'a kadar arama motorlarına kapalı. Uygulamayı yeni, temiz bir repoda sıfırdan yazıyorum.
- **Son güncelleme:** 2026-10-28.
- **Sıradaki adım:** Faz 4: önce açık soruları (S-02–S-06) karara bağlıyorum; ilk maddeler ortam doğrulamasının tam hali ve nonce'lu CSP.
- **Elle yapacaklarım:** eski fork'u tutan hesaba mesaj; Faz 3'te zorunlu kontrollere `build` ve üç `site-audit` kolunu eklemek; Faz 3'te Vercel ve Neon hesap adımları (Neon Frankfurt bölgesinde); Vercel token'ı ve repo değişkenleri (ADR 0011); Faz 9'da üretimi Search Console ve Bing'e eklemek; Faz 5'te logo.

## İlerleme

> Kural: biten madde aynı PR'da işaretlenir ve üstü çizilir (`- [x] ~~madde~~ — tarih, PR #N`).

### Kurulum

- [x] ~~Faz 0 — Yerel hazırlık~~ — 2026-10-28, yerel
- [x] ~~Faz 1 — Eski repo ve geçmiş (yerelde temizlendi ve yedeklendi, eski repoya force push edildi, sonra eski repo silindi; yeni repoya taşınmadı)~~ — 2026-10-28, elle
- [x] ~~Yeni repo, repo ayarları ve `main` dal koruması~~ — 2026-10-28, elle
- [ ] Faz 2 — Yönetişim altyapısı (PR #1–#8 birleşti; kalan: eski fork'u tutan hesaba mesaj (elle))

### Uygulama (PR ile)

- [x] ~~Faz 3 — Uygulama iskeleti ve kalite temeli (tooling'in TypeScript'e geçişi, Vercel ve Neon dahil)~~ — 2026-10-28, v0.1.0
- [ ] Faz 4 — Sunucu temeli
- [ ] Faz 5 — Marka ve tasarım sistemi
- [ ] Faz 6 — Herkese açık site (iki dilli)
- [ ] Faz 7 — Yönetim paneli
- [ ] Faz 8 — Sağlamlaştırma
- [ ] Faz 9 — Yayın
