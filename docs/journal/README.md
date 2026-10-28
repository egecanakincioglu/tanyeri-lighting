# Günlük

Her çalışma gününün kısa bir kaydı bu klasörde tutulur; bir sonraki oturum kaldığı yerden bu kayıtları okuyarak devam eder.

## Kurallar

- Her commit, aynı commit içinde o günün dosyasının "Commit günlüğü" bölümüne kendi başlığını ters tırnak içinde içeren Türkçe bir satır ekler. Git hook'u ve CI bunu zorlar.
- Her PR o günün dosyasındaki Özet'i günceller; Yapılanlar, Kararlar / öğrenilenler ve Yarım kalan / sıradaki bölümlerinin her birinde en az bir madde bulunur. CI bunu zorlar.
- `main`'deki, günlüğün başladığı commit'ten sonraki her merge dışı commit'in günlükte bir satırı vardır (CI kapsam denetimi). Başlangıç noktası bu dosyayı ekleyen commit'tir; revizyondan önceki 76 commit kapsam dışıdır.
- Git dışında elle yaptığım işler (hesap ve repo ayarları gibi) o günün Özet'ine yazılır.
- Dosya adı commit gününün tarihidir; gece yarısından sonra yeni dosya açılır.

## Şablon (`YYYY-MM-DD.md`)

```markdown
# YYYY-MM-DD

## Özet

### Yapılanlar

- ...

### Kararlar / öğrenilenler

- ...

### Yarım kalan / sıradaki

- ...

## Commit günlüğü

- `type(scope): summary` — Türkçe açıklama.
```
