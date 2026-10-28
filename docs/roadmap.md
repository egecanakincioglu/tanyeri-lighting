# Yol Haritası

> Vizyon: [vision.md](vision.md) · Ayrıntılı adımlar: [revizyon planı](plans/2026-10-27-revizyon.md) · Kararlar: [adr/](adr/README.md) · Günlük: [journal/](journal/README.md)

## Mevcut durum

- **Faz:** Faz 2'nin kurulum PR'ları birleşti; Faz 3 (uygulama iskeleti ve kalite temeli) başlıyor. Uygulamayı yeni, temiz bir repoda sıfırdan yazıyorum.
- **Son güncelleme:** 2026-10-28.
- **Sıradaki adım:** Faz 3'ün ilk işleri: `package.json`, pnpm ve TypeScript yapılandırması, repo araçlarının TypeScript'e geçişi. Hemen ardından Faz 2'den kalan iki koruma (yerel rehber, eski marka), sonra Faz 3'ün devamı. Faz 2'nin doküman işleri (rehberler, İngilizce `CONTRIBUTING.md` ve `SECURITY.md`, `.env.example`) sıradan bağımsız.
- **Elle yapacaklarım:** eski fork'u tutan hesaba mesaj; Faz 3'te zorunlu kontrollere `quality`, `test`, `build`, `analyze (actions)` ve üç `site-audit` kolunu eklemek; Faz 3'te Vercel ve Neon hesap adımları (Neon Frankfurt bölgesinde); Faz 9'da üretimi Search Console ve Bing'e eklemek; Faz 5'te logo.

## İlerleme

> Kural: biten madde aynı PR'da işaretlenir ve üstü çizilir (`- [x] ~~madde~~ — tarih, PR #N`).

### Kurulum

- [x] ~~Faz 0 — Yerel hazırlık~~ — 2026-10-28, yerel
- [x] ~~Faz 1 — Eski repo ve geçmiş (yerelde temizlendi ve yedeklendi, eski repoya force push edildi, sonra eski repo silindi; yeni repoya taşınmadı)~~ — 2026-10-28, elle
- [x] ~~Yeni repo, repo ayarları ve `main` dal koruması~~ — 2026-10-28, elle
- [ ] Faz 2 — Yönetişim altyapısı (PR #1–#8 birleşti; kalanlar: doküman işleri ve Faz 3'te tooling TypeScript'e geçince yapılacak iki koruma)

### Uygulama (PR ile)

- [ ] Faz 3 — Uygulama iskeleti ve kalite temeli (tooling'in TypeScript'e geçişi, Vercel ve Neon dahil)
- [ ] Faz 4 — Sunucu temeli
- [ ] Faz 5 — Marka ve tasarım sistemi
- [ ] Faz 6 — Herkese açık site (iki dilli)
- [ ] Faz 7 — Yönetim paneli
- [ ] Faz 8 — Sağlamlaştırma
- [ ] Faz 9 — Yayın
