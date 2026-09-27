> Potongan dari **PRD BINZI v1.3** (`../PRD-v1.3.md`). Rujukan silang "§x" menunjuk bagian lain — cari berkasnya di `../INDEX.md`. Jika potongan ini dan PRD utuh berbeda, PRD utuh yang berlaku.

## 11. Model Data

### 11.1 Catatan Desain Skema

| Keputusan skema | Alasan |
|---|---|
| Tidak ada tabel `certificates` | Sertifikat di luar MVP (K-03) |
| Tidak ada tabel `consultation_requests` | Konsultasi hanya tautan WhatsApp (K-10) |
| Tidak ada tabel `course_categories` / kolom `courses.category_id` | Kategori hanya untuk artikel (K-14) |
| `lessons.video_key` menyimpan kunci objek R2, bukan URL | URL bersifat sementara (presigned); kunci objek permanen |
| `enrollments.access_type` ada sejak awal meski semua gratis | Menyiapkan monetisasi tanpa migrasi besar (K-02) |
| Tabel `rate_limits` di PostgreSQL | Pengganti Redis, cukup untuk skala MVP (§12.4) |
| Tabel `sections` ada tapi UI-nya disembunyikan | Menghindari migrasi berisiko saat kursus mulai panjang |
| `articles.reviewer_id` wajib terisi saat publish | Kredibilitas konten kesehatan (K-11) |
| Konten kaya disimpan sebagai JSONB (dokumen TipTap) | Dapat divalidasi strukturnya — inilah yang menegakkan larangan video di teks |

### 11.2 Skema (notasi SQL; implementasi dengan Drizzle)

```sql
-- ============ IDENTITAS (kelola Better Auth) ============
users (
  id TEXT PK, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  image TEXT, email_verified BOOLEAN DEFAULT false,
  role user_role DEFAULT 'MEMBER',        -- MEMBER|EDITOR|ADMIN|SUPER_ADMIN
  status user_status DEFAULT 'ACTIVE',    -- ACTIVE|SUSPENDED|DELETED
  phone TEXT, last_login_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ,
  created_at, updated_at
)
sessions   (id, user_id FK, token UNIQUE, expires_at, ip_address, user_agent)
accounts   (id, user_id FK, provider_id, account_id, tokens…, UNIQUE(provider_id, account_id))
verifications (id, identifier, value, expires_at)

-- ============ KURSUS ============
-- Tidak ada course_categories: kursus tidak berkategori (K-14)

courses (
  id UUID PK, title, slug UNIQUE, summary, description JSONB,
  thumbnail_url, level course_level,
  estimated_minutes INT, is_sequential BOOLEAN DEFAULT true,
  status content_status DEFAULT 'DRAFT',
  final_quiz_id UUID UNIQUE NULL,
  reviewer_id FK NULL, reviewed_at TIMESTAMPTZ NULL,
  seo_title, seo_description, published_at,
  enrollment_count INT DEFAULT 0,
  created_by, updated_by, created_at, updated_at
)

sections (id, course_id FK, title, order_index)     -- siap pakai, UI disembunyikan di MVP

lessons (
  id UUID PK, course_id FK, section_id FK NULL,
  title, slug, order_index INT NOT NULL,
  content JSONB NOT NULL,                  -- dokumen TipTap
  video_key TEXT NULL,                     -- kunci objek di R2
  video_status video_status DEFAULT 'NONE',-- NONE|UPLOADING|READY|FAILED
  video_duration_seconds INT, video_size_bytes BIGINT,
  quiz_id UUID UNIQUE NULL,
  is_free_preview BOOLEAN DEFAULT false,
  estimated_minutes INT, created_at, updated_at,
  UNIQUE(course_id, slug)
)

-- ============ QUIZ ============
quizzes (
  id UUID PK, type quiz_type NOT NULL,     -- LESSON | FINAL
  title, instructions TEXT,
  duration_minutes INT NOT NULL CHECK (BETWEEN 1 AND 180),
  passing_score_percent INT DEFAULT 70,    -- label informatif di MVP
  max_attempts INT NOT NULL DEFAULT 1,     -- 1 = sekali kerjakan (K-04)
  cooldown_minutes INT DEFAULT 0,          -- tidak relevan saat max_attempts = 1
  questions_per_attempt INT NULL,
  shuffle_questions BOOLEAN DEFAULT true,
  shuffle_options BOOLEAN DEFAULT true,
  explanation_policy explanation_policy DEFAULT 'ALWAYS',  -- ALWAYS|ON_PASS_ONLY|NEVER
  created_at, updated_at
)

questions (
  id UUID PK, quiz_id FK, order_index INT,
  type question_type DEFAULT 'SINGLE_CHOICE',
  text JSONB NOT NULL, image_url TEXT NULL,
  explanation JSONB NULL,      -- boleh NULL hanya saat draft; wajib terisi untuk simpan final, impor CSV, dan publish (Q40, §11.4 no. 12)
  points INT DEFAULT 1,
  topic_tag TEXT NULL          -- bagian materi yang diuji; dipakai saat gagal (QZ-20)
)

question_options (
  id UUID PK, question_id FK, order_index INT,
  text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false   -- JANGAN diserialisasi ke klien
)

quiz_attempts (
  id UUID PK, quiz_id FK, user_id FK, enrollment_id FK,
  attempt_number INT NOT NULL,
  status attempt_status DEFAULT 'IN_PROGRESS',  -- IN_PROGRESS|SUBMITTED|EXPIRED
  question_order UUID[] NOT NULL,               -- dikunci saat attempt dimulai
  started_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,              -- OTORITATIF, dihitung server
  submitted_at TIMESTAMPTZ,
  score INT, max_score INT, score_percent NUMERIC(5,2), is_passed BOOLEAN,
  reset_by FK NULL, reset_reason TEXT, reset_at TIMESTAMPTZ,  -- jalur pemulihan (QZ-19)
  focus_lost_count INT DEFAULT 0, ip INET,
  UNIQUE(quiz_id, user_id, attempt_number)
)
CREATE UNIQUE INDEX one_active_attempt ON quiz_attempts (quiz_id, user_id)
  WHERE status = 'IN_PROGRESS';

quiz_answers (
  id UUID PK, attempt_id FK, question_id FK,
  selected_option_id FK NULL, is_correct BOOLEAN NULL,
  points_earned INT DEFAULT 0, answered_at TIMESTAMPTZ,
  UNIQUE(attempt_id, question_id)
)

-- ============ PROGRESS & NILAI ============
enrollments (
  id UUID PK, user_id FK, course_id FK,
  access_type access_type DEFAULT 'FREE',   -- FREE|PAID (disiapkan untuk fase 2)
  status enrollment_status DEFAULT 'IN_PROGRESS',  -- IN_PROGRESS|COMPLETED|PASSED
  enrolled_at, completed_at TIMESTAMPTZ NULL,
  progress_percent NUMERIC(5,2) DEFAULT 0,
  final_score_percent NUMERIC(5,2) NULL,    -- (rata2 quiz materi × 60%) + (final × 40%)
  last_lesson_id FK NULL,
  total_seconds_spent INT DEFAULT 0,
  reset_count INT DEFAULT 0,                -- berapa kali user mengulang kursus
  UNIQUE(user_id, course_id)
)

lesson_progress (
  id UUID PK, user_id FK, lesson_id FK, enrollment_id FK,
  status progress_status DEFAULT 'NOT_STARTED',
  video_watched_percent NUMERIC(5,2) DEFAULT 0,
  video_last_position_seconds INT DEFAULT 0,
  quiz_attempted BOOLEAN DEFAULT false,          -- ← gerbang materi berikutnya
  quiz_score_percent NUMERIC(5,2) NULL,          -- nilai tunggal & final
  quiz_is_passed BOOLEAN NULL,                   -- label saja, tidak mengunci apa pun
  quiz_submitted_at TIMESTAMPTZ NULL
  first_accessed_at, completed_at,
  UNIQUE(user_id, lesson_id)
)

-- ============ ARTIKEL ============
article_categories (id, name, slug UNIQUE, description, icon, color, order_index)

articles (
  id UUID PK, title, slug UNIQUE, excerpt,
  content JSONB NOT NULL, cover_url,
  category_id FK NOT NULL,                  -- TEPAT SATU kategori
  author_id FK, reviewer_id FK NULL, reviewed_at TIMESTAMPTZ NULL,
  reading_minutes INT, view_count INT DEFAULT 0,
  related_course_id FK NULL,
  status content_status DEFAULT 'DRAFT',
  seo_title, seo_description, published_at,
  search_vector TSVECTOR,
  created_at, updated_at
)
tags (id, name, slug UNIQUE)
article_tags (article_id FK, tag_id FK, PK(article_id, tag_id))

-- ============ KONSULTASI ============
-- TIDAK ADA TABEL. Konsultasi adalah section di Beranda dengan tautan WhatsApp.
-- Nomor WhatsApp & jam operasional disimpan di system_settings:
--   {"consultation.whatsapp_number": "628xxxxxxxxxx",
--    "consultation.operating_hours": "Senin-Jumat 09.00-17.00 WIB",
--    "consultation.response_sla": "1x24 jam"}

-- ============ OPERASIONAL ============
media_assets (
  id UUID PK, type media_type,              -- IMAGE|VIDEO|DOCUMENT
  storage_key TEXT UNIQUE, url TEXT, filename, mime_type,
  size_bytes BIGINT, width INT, height INT, duration_seconds INT,
  alt_text TEXT, uploaded_by FK, created_at
)

audit_logs (
  id BIGSERIAL PK, actor_id FK, action TEXT,
  entity_type TEXT, entity_id TEXT,
  before JSONB, after JSONB, ip INET, created_at
)

rate_limits (                                -- pengganti Redis
  key TEXT PRIMARY KEY,                      -- mis. "login:user@mail.com"
  count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL
)
CREATE INDEX ON rate_limits (expires_at);    -- dibersihkan lewat cron

system_settings (key TEXT PK, value JSONB, updated_by FK, updated_at)
-- {"quiz.min_questions": 10, "score.lesson_weight": 60, "score.final_weight": 40}
```

### 11.3 Index Penting

```sql
CREATE INDEX ON courses (status, published_at DESC) WHERE status = 'PUBLISHED';
CREATE INDEX ON articles (status, category_id, published_at DESC);
CREATE INDEX ON articles USING GIN (search_vector);
CREATE INDEX ON enrollments (user_id, updated_at DESC);
CREATE INDEX ON lesson_progress (user_id, lesson_id);
CREATE INDEX ON quiz_attempts (user_id, quiz_id);
CREATE INDEX ON lessons (course_id, order_index);
```

### 11.4 Aturan Integritas

1. `articles.category_id` **NOT NULL** — satu artikel tepat satu kategori.
2. Hapus kategori yang masih punya artikel → **ditolak** (`ON DELETE RESTRICT`).
3. `courses.final_quiz_id` dan `lessons.quiz_id` **UNIQUE** — satu quiz per pemilik.
4. Kursus `PUBLISHED` yang punya enrollment tidak boleh dihapus — gunakan `ARCHIVED`.
5. `quiz_attempts.expires_at` selalu dihitung server.
6. Reset progress kursus **tidak menghapus** `quiz_attempts` — hanya menaikkan `reset_count` dan mengosongkan `lesson_progress`.
7. **Gerbang materi diberlakukan di server.** Endpoint materi ke-N memeriksa `quiz_attempted = true` pada materi ke-(N−1). Menyembunyikan tautan di UI tidak cukup.
8. **Attempt kedua ditolak di server.** Percobaan membuat attempt baru untuk quiz yang sudah `SUBMITTED`/`EXPIRED` dikembalikan 409, kecuali ada baris reset yang sah.
9. `max_attempts` untuk quiz materi **selalu 1** — tidak dapat diubah dari CMS di MVP.
10. **Pembahasan & `is_correct` hanya diserialisasi setelah attempt `SUBMITTED` atau `EXPIRED`**, tidak pernah sebelumnya.
11. Reset attempt **wajib** menyertakan `reset_reason` dan tercatat di `audit_logs`.
12. **Aturan soal (Q40) ditegakkan di server:** pilihan ganda tepat 4 opsi dengan tepat 1 benar; benar/salah tepat 2 opsi dengan tepat 1 benar; pembahasan terisi. Diperiksa saat soal disimpan di editor, saat impor CSV (baris yang melanggar ditolak dengan alasan), dan saat quiz dipublikasikan (quiz dengan soal yang melanggar tidak bisa terbit). Kolom `explanation` tetap boleh NULL di database agar draft bisa auto-save.
