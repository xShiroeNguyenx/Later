# Later. — MVP Plan

> *You don't have to solve everything tonight.*

**Status:** MVP đã build xong, có tiếng Việt, có CI deploy lên GitHub Pages.
80/80 automated check pass trên Chromium.
**Còn lại:** kiểm tra trên iPhone + Android thật với màn hình khoá — xem mục 11.
**Last updated:** 2026-08-13

> Kế hoạch gốc giữ nguyên bên dưới để đối chiếu. Những chỗ thực tế làm khác được
> ghi ở **mục 13 — Nhật ký thi công**, phần tiếng Việt ở **mục 14**, phần CI ở
> **mục 15**.

---

## 1. Context

**Vấn đề cần giải:** Người overthinking lúc 1–3h sáng không cần một sleep tracker, không cần meditation app 40 bài, và tuyệt đối không cần configure gì. Họ cần: mở → bấm một nút → vài phút sau dịu xuống → ngủ.

**Sản phẩm:** một web app (PWA) cực nhỏ, không account, không database, không notification, chạy offline.

**Định vị:** **Overthinking → Rest.**
Không phải sleep-tracking app. Không phải meditation app. Không phải music player.

**Triết lý sản phẩm:** *Less app. More rest.*
Mọi quyết định thiết kế đều phải trả lời được câu hỏi: *"thứ này có bắt người đang mất ngủ phải suy nghĩ thêm không?"* Nếu có → cắt.

### Quyết định đã chốt

| Hạng mục | Lựa chọn |
|---|---|
| Stack | Vite + React + TypeScript (static build) |
| Audio | Kết hợp — file loop CC0 làm nền + procedural Web Audio làm texture |
| Tên | **Later.** |
| Ngôn ngữ UI | English only |
| Hosting | Cloudflare Pages hoặc Vercel (static, free tier) |

---

## 2. Bốn điều chỉnh so với ý tưởng gốc

**2.1 — Ban đêm KHÔNG bao giờ hiển thị lại các thought đã park.**
Đây là chi tiết UX quan trọng nhất của feature Park. Nếu 2h sáng app hiện "Bạn đã park 3 điều" → phản tác dụng hoàn toàn, não sẽ lôi cả 3 ra nhai lại. Quy tắc: thoughts chỉ xuất hiện khi mở app trong khung **06:00–20:00**, và cũng chỉ dưới dạng một dòng nhỏ mờ, không tự bung ra.

**2.2 — Nhịp thở dùng exhale dài hơn inhale (4s vào / 6s ra), không phải 1:1.**
Thở ra dài hơn thở vào kích hoạt phó giao cảm — đây là cơ chế sinh lý thực sự làm dịu, không phải trang trí. Không dùng 4-7-8 cho MVP vì giữ hơi 7s gây khó chịu với người chưa quen và có thể làm *tăng* lo âu.

**2.3 — "Empty Mind" phải thật sự trống, kể cả trống về mặt thị giác.**
Không orb, không animation phóng to thu nhỏ. Chỉ chữ hiện ra rồi tan đi trên nền đen, rồi im lặng tuyệt đối. Đây là mode khác biệt nhất — đừng làm nó thành "Calm không nhạc".

**2.4 — Tự dim sau 12s ("still here").**
Sau 12s không chạm, toàn bộ UI mờ xuống còn ~12% opacity. Người dùng không cần làm gì, app tự biến mất khỏi tầm mắt. Đây là cách app "im lặng" mà không cần tắt.

Không thêm gì khác vào MVP. Đặc biệt **không có AI ở V1**.

---

## 3. Rủi ro kỹ thuật #1 — phải spike trước khi build

**Vấn đề:** use case là *nằm trên giường, khoá màn hình, ngủ*. Nhưng:

- Trên **iOS Safari**, `AudioContext` bị suspend khi khoá màn hình → procedural audio **im bặt**.
- `setInterval` / `setTimeout` bị throttle nặng ở background tab → timer đếm sai.
- `requestAnimationFrame` dừng hẳn ở background.

### Giải pháp kiến trúc audio hai lớp

```
┌─ Lớp NỀN — bắt buộc sống khi khoá màn hình ──────────┐
│  HTMLAudioElement + file .opus loop thật              │
│  + MediaSession API  (title: "Later. · Rain")         │
│  → iOS/Android coi đây là media playback hợp lệ       │
│  → tiếp tục phát khi khoá màn hình, có control        │
└───────────────────────────────────────────────────────┘
                 +  (chồng lên, best-effort)
┌─ Lớp TEXTURE — chỉ khi app foreground ───────────────┐
│  Web Audio: pink noise → bandpass → LFO drift         │
│  + one-shot thunder / crickets ngẫu nhiên 40–90s      │
│  → chống cảm giác "nghe ra điểm loop"                 │
│  → nếu bị suspend ở background: chấp nhận, nền còn    │
└───────────────────────────────────────────────────────┘
```

### Timer phải timestamp-based, không đếm tick

```ts
// SAI — bị throttle ở background, sẽ trôi vài phút:
setInterval(() => remaining--, 1000)

// ĐÚNG:
const endAt = Date.now() + durationMs
const remaining = () => Math.max(0, endAt - Date.now())
```

Breathing animation dùng **CSS `@keyframes`** (chạy trên compositor, không phụ thuộc rAF) chứ không phải JS animation loop.

> **Ngày 1 phải làm spike này trên iPhone + Android thật trước khi viết tiếp.**
> Nếu lớp nền không sống qua khoá màn hình, toàn bộ sản phẩm vô nghĩa.
> Kết quả spike ghi lại ở mục 10 bên dưới.

---

## 4. Cấu trúc dự án

```
Later/
├─ index.html                    ← nút Rest nằm sẵn trong HTML tĩnh
├─ package.json
├─ vite.config.ts                ← vite-plugin-pwa
├─ tsconfig.json
├─ PLAN.md                       ← file này
├─ public/
│  ├─ manifest.webmanifest
│  ├─ icons/                     (192, 512, maskable)
│  └─ audio/
│     ├─ CREDITS.md              ← nguồn + license từng file
│     ├─ rain-base.opus          ~350KB, loop 60s
│     ├─ window-rain.opus        ~350KB
│     ├─ night-ambience.opus     ~350KB
│     ├─ thunder-1.opus          ~70KB   (one-shot)
│     ├─ thunder-2.opus          ~70KB   (one-shot)
│     └─ silence.opus            ~2KB    (giữ audio session sống)
└─ src/
   ├─ main.tsx
   ├─ App.tsx                    ← 3 trạng thái: home / session / parked
   ├─ theme.css                  ← palette + keyframes
   ├─ audio/
   │  ├─ engine.ts               ← AudioEngine: play / stop / fade / duck
   │  ├─ layers.ts               ← định nghĩa 4 soundscape
   │  ├─ procedural.ts           ← noise buffer, bandpass, LFO
   │  └─ mediaSession.ts         ← lock-screen metadata & controls
   ├─ session/
   │  ├─ useSession.ts           ← state machine + timestamp clock
   │  ├─ scripts.ts              ← timeline micro-copy 3 mode
   │  └─ Breath.tsx              ← orb 4s-in / 6s-out
   ├─ park/
   │  ├─ ParkSheet.tsx           ← ô nhập + "Park it"
   │  ├─ ParkedList.tsx          ← chỉ hiện 06:00–20:00
   │  └─ storage.ts              ← localStorage, schema versioned
   ├─ screens/
   │  ├─ Home.tsx
   │  └─ Session.tsx
   └─ lib/
      ├─ prefs.ts                ← nhớ mode + sound + duration lần cuối
      ├─ clock.ts                ← "2:17 AM", isNightTime()
      └─ idle.ts                 ← auto-dim sau 12s
```

---

## 5. Thiết kế màn hình

### Home — lần đầu

```
                2:17 AM

                  🌙

        You don't have to
        figure it out tonight.

             ┌─────────┐
             │  Rest   │
             └─────────┘

        ─────────────────────
         🌧 Rain  ·  20 min
```

- Thời gian thật ở góc trên, mờ (opacity .3).
- Dòng `🌧 Rain · 20 min` là **một control duy nhất** — chạm vào mới mở picker. Mặc định không ai phải chạm.
- Nút Rest to, bo tròn, không viền sắc, phản hồi chạm bằng scale nhẹ.

### Home — lần sau (đã có prefs)

```
                2:41 AM

                  🌙

            Welcome back

           ┌─────────────┐
           │ Rest again  │
           └─────────────┘

         Rain · 20 min · Calm
```

### Session

- Nền chuyển sang gần đen tuyệt đối.
- Orb thở (Calm) / chỉ chữ (Empty Mind) / một điểm sáng rất mờ (Rain).
- **Không progress bar, không đếm ngược** — nhìn thấy "còn 14:32" là quay lại tư duy thời gian.
- Sau 12s không chạm → mọi thứ mờ còn 12%.
- Chạm bất kỳ đâu → hiện lại 3 control, rồi lại tan:
  `Park a thought` · `−5 min / +5 min` · `End`

### Picker (chỉ khi chủ động chạm)

Một sheet trượt lên, tất cả trong **một** màn hình, không có bước nào:

```
Sound   ○ Rain   ○ Window rain   ○ Night   ○ None
Mode    ○ Rain   ○ Calm   ○ Empty Mind
Time    ○ 10     ○ 20     ○ 45     ○ Until I stop
```

---

## 6. Ba mode & timeline micro-copy

Tất cả đặt trong `src/session/scripts.ts` dưới dạng data thuần:

```ts
type Cue = { at: number; text: string | null; hold: number }
```

### 🫧 Calm — mặc định

| t | Nội dung |
|---|---|
| 0:00 | audio fade-in 20s, orb hiện ra rất chậm |
| 0:20 | *You don't have to figure anything out right now.* |
| 1:00 | *Let the sound take up the space.* |
| 1:40 | *Breathe in… and let it out, slower.* |
| 3:00 | *Nothing needs to be solved tonight.* |
| 5:00 | *If a thought comes back — it can wait.* |
| 6:00+ | im lặng chữ, chỉ còn orb + audio |
| T−2:00 | orb chậm dần, audio bắt đầu fade |
| T−0:20 | *Good night.* rồi tan hết |

### 🌧 Rain

Không hướng dẫn. Không orb. Chỉ audio + một điểm sáng rất mờ pulse theo nhịp mưa.
Một câu duy nhất ở **0:30**: *Just the rain now.* Rồi thôi.

### 🌌 Empty Mind

Không audio. Nền đen tuyệt đối. Mỗi câu fade-in 3s → giữ 6s → fade-out 3s:

```
0:00   Breathe in.
0:12   Breathe out.
0:30   You don't need to solve this tonight.
1:00   (im lặng — màn hình đen hoàn toàn)
 ...   3 phút không có gì
4:00   Still here. That's enough.
 ...   im lặng cho tới hết
```

---

## 7. Park your thoughts

**Lối vào:** nút rất nhỏ ở Home (`+ park a thought`), và trong Session sau khi chạm để hiện control.

**Flow:**

```
What's on your mind?
┌────────────────────────────────┐
│ prep the slides                │
└────────────────────────────────┘
              [ Park it ]
```

→ ngay lập tức:

```
Saved for tomorrow.
You don't need to think about it tonight.
```

→ tự đóng sau 2.5s, quay lại session.
Nếu đang trong session: **audio không dừng, không đổi gì.**

**Storage** (`park/storage.ts`):

```ts
type Thought = { id: string; text: string; parkedAt: number; done?: boolean }
// localStorage key: "later.thoughts.v1"
```

**Quy tắc hiển thị (quan trọng nhất):**

- `isNightTime()` = giờ hiện tại trong khoảng 20:00–06:00 → **không bao giờ** render danh sách.
- Ban ngày, Home hiện thêm một dòng mờ: `You parked 3 thoughts last night →`
- Chạm vào → danh sách đơn giản, mỗi item có nút ✓ để xoá.
- **Không nhắc, không badge đỏ, không notification.**

---

## 8. Palette & chuyển động

```css
:root {
  --bg:      #05070b;                     /* gần đen, hơi lạnh */
  --bg-deep: #000205;                     /* nền session */
  --ink:     rgba(255, 242, 228, .62);    /* trắng ngà ấm — KHÔNG dùng #fff */
  --ink-dim: rgba(255, 242, 228, .28);
  --accent:  rgba(255, 198, 150, .40);    /* hổ phách, ít ánh sáng xanh */
  --orb:     radial-gradient(circle, rgba(255,205,160,.18), transparent 70%);
}
```

- Không dùng pure white, không dùng xanh dương bão hoà — cả hai đều ức chế melatonin.
- Mọi transition ≥ 800ms, easing `cubic-bezier(.4, 0, .2, 1)`. Không có gì được chuyển động nhanh.
- Tôn trọng `prefers-reduced-motion`: orb đứng yên, chỉ đổi opacity.

**Breath orb — thuần CSS, không JS:**

```css
@keyframes breathe {
  0%   { transform: scale(.72); }
  40%  { transform: scale(1.00); }   /* 4s inhale */
  100% { transform: scale(.72); }    /* 6s exhale */
}
.orb { animation: breathe 10s ease-in-out infinite; }
```

---

## 9. Yêu cầu "mở cực nhanh"

Đây là **ràng buộc sản phẩm**, không phải mục tiêu tối ưu để dành về sau.

| Ràng buộc | Cách đạt |
|---|---|
| First paint < 400ms trên 4G | Nút Rest + 🌙 + CSS nền **nằm sẵn trong `index.html`**, inline critical CSS. React hydrate sau. |
| JS bundle < 60KB gzip | Không UI library, không animation library, không router. State bằng `useState` + một reducer. |
| Không loading screen | Không spinner ở bất kỳ đâu. Audio tải sau first paint qua `requestIdleCallback`. |
| Không popup | Không cookie banner (không có cookie), không "add to home screen" prompt tự động. |
| Offline hoàn toàn | `vite-plugin-pwa` precache app shell + audio. Lần thứ 2 mở là instant, kể cả không mạng. |

Budget được enforce bằng `rollup-plugin-visualizer` + một lần check thủ công ở cuối mỗi phase.

---

## 10. Kế hoạch thực thi

### Ngày 1 — Spike + khung

- [ ] `npm create vite@latest . -- --template react-ts`, cài `vite-plugin-pwa`
- [ ] **Spike audio nền** (ưu tiên tuyệt đối): `HTMLAudioElement` + loop + MediaSession, test trên iPhone Safari và Chrome Android với màn hình khoá 10 phút
- [ ] Ghi kết quả spike vào mục này
- [ ] Nếu spike đạt: dựng `index.html` với nút Rest tĩnh + palette

> **Kết quả spike:** Kiến trúc 2 lớp đứng vững, nhưng spike phát hiện một thứ
> kế hoạch không lường được: **iOS Safari không cho ghi `HTMLMediaElement.volume`**
> → không thể fade bằng software trên iPhone. Cách giải (lull đặt trong seam của
> loop) ở **mục 13.2**. Đã verify bằng cách giả lập đúng hạn chế đó và đo vị trí
> dừng thật: 46.41 s, nằm trong vùng lull. **Chưa** verify trên iPhone thật với
> màn hình khoá — xem mục 11.

### Ngày 2 — Audio engine + session runtime

- [ ] `audio/engine.ts` — play / stop / crossfade / fadeOut(duration), gain envelope bằng `setTargetAtTime`
- [ ] `audio/procedural.ts` — pink-noise buffer, bandpass + LFO drift, one-shot scheduler ngẫu nhiên
- [ ] `session/useSession.ts` — state machine `idle → playing → fading → done`, clock timestamp-based, xử lý `visibilitychange`

### Ngày 3 — 3 mode + UI session

- [ ] `scripts.ts` với timeline đầy đủ 3 mode
- [ ] `Breath.tsx`, `Session.tsx`
- [ ] Auto-dim (`lib/idle.ts`), tap-to-reveal controls
- [ ] Picker sheet một màn hình

### Ngày 4 — Park + memory + PWA

- [ ] `park/*` — sheet nhập, storage versioned, quy tắc `isNightTime()`
- [ ] `lib/prefs.ts` — nhớ mode/sound/duration → màn hình "Welcome back"
- [ ] Manifest, icons, service worker
- [ ] Test Add to Home Screen trên cả iOS và Android

### Ngày 5 — Asset + polish + QA

- [ ] Thu thập audio CC0 (Freesound CC0 / Pixabay Sounds), cắt loop seamless, encode Opus mono 48kbps
- [ ] Ghi nguồn + license vào `public/audio/CREDITS.md`
- [ ] Kiểm tra bundle size, Lighthouse, `prefers-reduced-motion`, tab keyboard, contrast
- [ ] Deploy Cloudflare Pages / Vercel

**Ước lượng: 4–5 ngày làm việc.** Ngày 1 là ngày rủi ro nhất.

---

## 11. Verification

### Đã tự động hoá — 80/80 pass trên Chromium (mobile viewport 390×844)

Script Playwright chạy thật, không mock: mở app, bấm nút, đợi hết cả session
1 phút, tắt mạng, giả lập cả hạn chế `volume` của iOS.

| # | Kiểm tra | Kết quả |
|---|---|---|
| 1 | FCP | **216 ms** (ngân sách 400 ms) |
| 2 | Shell tĩnh bị thay bằng React mà không nhảy layout | pass |
| 3 | Bấm Rest **trước khi** bundle tải xong → audio vẫn chạy, vào đúng session | pass |
| 4 | Bed đúng file, `loop=true`, đang phát, fade-in từ `volume≈0.03` và tăng dần | pass |
| 5 | Session tự mờ sau 12 s, chạm lại thì hiện ra | pass |
| 6 | Park giữa session → audio **không** bị ngắt, thoughts lưu vào localStorage | pass |
| 7 | **02:17 sáng: không hiện bất kỳ parked thought nào** | pass |
| 8 | 09:04 sáng: hiện dòng "You parked 1 thought …" → mở list → tick để xoá | pass |
| 9 | Empty Mind: không tạo audio element, không orb, không glimmer | pass |
| 10 | Rain only: có glimmer, không orb, load đúng `window-rain.m4a` | pass |
| 11 | Reduced motion: orb đổi sang `breathe-still` (pulse, không scale) | pass |
| 12 | Tắt mạng → reload → app chạy → **audio phát từ cache** | pass |
| 13 | **Kết thúc, đường có `volume`**: đứng ở 1.000 trước cửa sổ fade → 0.534 → 0.124 → stop → màn hình khép lại | pass |
| 14 | **Kết thúc, đường iOS** (`volume` bị vô hiệu): không đụng volume, dừng đúng tại `currentTime = 46.41s` — nằm trong vùng lull của seam | pass |
| 15 | Bundle: app JS **16.9 KB gzip**, đủ để paint 4.5 KB | pass |
| 16 | **VI: `html[lang]` set xong trước khi body paint**, shell hiện tiếng Việt, span tiếng Anh không render | pass |
| 17 | VI: đồng hồ 24 giờ, không AM/PM | pass |
| 18 | VI: shell và React Home in **cùng một chuỗi** (`Mưa · 20 phút`) → hydration không nhảy chữ | pass |
| 19 | VI: picker, cue trong session, luồng park — dịch hết | pass |
| 20 | Đổi VI→EN: nhãn compose lại ngay, `html.lang` đổi, nhãn lưu trong localStorage theo ngôn ngữ mới | pass |
| 21 | Build với `BASE_PATH=/Later/` → không còn đường dẫn absolute nào, manifest `start_url`/`scope` đúng, `sw.js` navigateFallback đúng | pass |

Kiểm tra khách quan asset audio (giải mã lại file `.m4a` rồi đo):

| | duration | RMS giữa | RMS tại seam | độ sâu lull |
|---|---|---|---|---|
| rain-base | 48.000 s | −18.6 dB | −26.6 dB | **−8.0 dB** |
| window-rain | 48.000 s | −19.0 dB | −28.1 dB | **−9.2 dB** |
| night-ambience | 48.000 s | −23.2 dB | −29.3 dB | **−6.2 dB** |

Duration đúng chính xác 48.000 s → AAC không chèn padding, `loop` liền mạch.
Seam và tail lệch ≤ 1 dB → chỗ nối không có bậc. Lull sống sót qua encoder, tức
cơ chế fade cho iOS còn nguyên.

### Chưa làm được ở đây — bắt buộc phải test trên máy thật

Không có test tự động nào thay được, vì Chromium desktop không có audio session
của iOS/Android:

1. **Khoá màn hình 10 phút** — iPhone Safari + Chrome Android. Bấm Rest → khoá
   máy → sau 10 phút audio vẫn phát, lock screen hiện "Later. · Rain · 20 min",
   nút pause hoạt động.
   *→ Vẫn là tiêu chí pass/fail của cả sản phẩm.* Kiến trúc 2 lớp được thiết kế
   riêng cho việc này và đã pass mọi thứ kiểm được trên desktop, nhưng bản thân
   hành vi khoá máy thì chưa được chứng minh.
2. **Timer ở background trên máy thật** — đặt 10 min, khoá máy, đối chiếu thời
   điểm audio tắt với đồng hồ. Đường iOS cố tình dừng trong khoảng **±24 s** so
   với mốc (nó đợi lull), không phải ±5 s như dự kiến ban đầu.
3. **Chỗ nối loop qua tai người** — nghe liên tục 5 phút, xem có nhận ra điểm lặp
   ở mỗi 48 s không. Số đo nói là không, nhưng tai mới là trọng tài.
4. **Add to Home Screen** trên cả iOS và Android, rồi mở ở chế độ standalone.
5. **Cold open trên 4G thật**, không phải throttle của DevTools.

```bash
npm run dev -- --host        # test trên máy thật qua LAN
npm run build                # typecheck + build
npm run size                 # ngân sách bundle
npm run preview -- --host    # test service worker (SW không chạy ở dev)

# build đúng như CI làm khi deploy lên project site của GitHub Pages
BASE_PATH=/Later/ npm run build && node scripts/check-base.mjs /Later/
```

*(Trên Git Bash ở Windows, `BASE_PATH=/Later/` bị MSYS đổi thành đường dẫn Windows.
Dùng PowerShell: `$env:BASE_PATH='/Later/'; npm run build`.)*

---

## 12. Ngoài phạm vi MVP

Ghi lại để không bị cám dỗ:

- **AI Sleep Companion** — V2, sau khi có người dùng thật. Vai trò của AI ở đây *không phải* giải quyết vấn đề thay người dùng, mà giúp họ tạm đặt vấn đề xuống.
- Account, sync, database — có thể không bao giờ cần.
- Sleep tracking, thống kê, streak — **đi ngược triết lý sản phẩm**; một streak là một áp lực.
- Notification, reminder giờ ngủ.
- ~~i18n (đã chốt English only)~~ → **đã làm sau khi build MVP**, xem mục 14.
- Analytics cá nhân hoá.

---

## 13. Nhật ký thi công — những chỗ làm khác kế hoạch

### 13.1 Không dùng Opus. Dùng AAC/M4A.

Kế hoạch ghi `.opus`. **iOS Safari không hỗ trợ Ogg Opus** — mà iOS chính là nền
tảng phải chạy được khi khoá màn hình, nên Opus là lựa chọn sai ngay từ đầu. AAC
trong `.m4a` là format duy nhất mọi trình duyệt phát nền đáng tin cậy. Tốn thêm
chút dung lượng (1.21 MB thay vì ~1 MB), nhưng đây không phải chỗ để tiết kiệm.

### 13.2 Phát hiện lớn nhất: iOS không cho set `volume`, nên fade phải nằm trong asset

`HTMLMediaElement.volume` là **read-only trên iOS Safari**. Nghĩa là trên iPhone
không có cách nào fade bằng software. Nếu không xử lý, hết 20 phút là tiếng mưa
bị **cắt phựt** giữa lúc đang mưa to — đúng kiểu làm giật mình người sắp ngủ.

Cách giải: mỗi bed được sinh ra với một **vùng lắng (lull) đặt ngay tại chỗ nối
loop** — biên độ tụt −6…−9 dB trong khoảng 3 giây, vòng qua cả hai đầu file. App
chỉ bắt đầu và kết thúc phát **bên trong vùng lull đó**. Chính nội dung âm thanh
làm việc fade.

- Bắt đầu: `currentTime = 0` → vào đúng lúc mưa nhẹ nhất.
- Kết thúc: khi còn ≤ 24 s, arm cờ chờ; `timeupdate` phát hiện `currentTime` vào
  vùng lull thì `pause()`. Đo được: dừng tại **46.41 s**.
- Bấm End: nhảy `currentTime` tới `48 − 1.1 s` rồi pause sau 1.1 s → nghe như
  tiếng mưa lịm dần trong 1 giây.
- Nơi nào `volume` chạy được (Android, desktop) thì vẫn fade thật.

Phát hiện `volume` có dùng được hay không bằng cách **ghi vào rồi đọc lại**, không
sniff user agent.

Điều thú vị: lựa chọn "kết hợp cả hai" của bạn hoá ra là điều kiện tiên quyết cho
cách giải này. Nếu chỉ procedural thì iOS im bặt lúc khoá máy; nếu chỉ file thì
không có lớp che điểm loop.

### 13.3 Preact thay React (source vẫn là React)

React 19 + react-dom ≈ 48 KB gzip, gần hết ngân sách 60 KB trước khi viết dòng
code nào. `react` được alias sang `preact/compat` ở tầng build → runtime ~11 KB.
**Không có file source nào viết theo kiểu Preact** — vẫn `import { useState } from
'react'`. Muốn quay lại React thật: bỏ plugin `preact()` trong `vite.config.ts`,
`npm i react react-dom`, xoá block `paths` trong tsconfig. Không sửa source.

Kết quả: app JS **14.7 KB gzip**.

### 13.4 Không có `theme.css`. Toàn bộ CSS inline trong `index.html`.

Vite tự chèn `<link rel="stylesheet">` vào `<head>` → render-blocking → phá đúng
cái ràng buộc quan trọng nhất. CSS của app chỉ ~3 KB gzip, rẻ hơn một request, và
đảm bảo không bao giờ có flash of unstyled text lúc 2 giờ sáng.

### 13.5 Audio KHÔNG precache. Và phải `fetch()` để mồi cache.

Precache 1.21 MB audio khiến lần đầu vào app tốn cả megabyte — sai triết lý. Đổi
sang runtime cache.

Nhưng có một cái bẫy thật, phát hiện khi test offline (test này **fail lần đầu**):
media element gửi **Range request**, server trả **206**, và không cache nào chấp
nhận 206. Để tự nhiên thì bed **vĩnh viễn không vào cache** và app vô dụng khi mất
mạng. Cách sửa: một `fetch()` thường để đặt bản 200 đầy đủ vào cache, sau đó mới
bật `preload='auto'` trên element — file tải qua mạng đúng một lần.

### 13.6 Asset audio là tự tổng hợp, không phải CC0 tải về

Kế hoạch định lấy CC0 từ Freesound rồi ghi `CREDITS.md`. Thực tế `npm run audio`
sinh toàn bộ từ ~200 dòng DSP. Không có gì để attribute, nên **không cần
CREDITS.md**. Lợi ích lớn hơn chuyện license: loop liền mạch *do cấu trúc* — tile
một chu kỳ noise, filter, chỉ giữ chu kỳ cuối (lúc đó filter đã vào steady state,
tail nối head khớp chính xác). Đo được: bước nhảy tại seam = 1.13× bước nhảy
trung bình giữa hai sample liền kề, tức không có đứt.

Icon cũng vậy — tự viết PNG encoder, toolchain không có dependency ảnh nào.

### 13.7 Bỏ `silence.opus`

Định dùng để giữ audio session. Không cần: gọi `play()` ngay trong gesture là đủ,
và Empty Mind vốn im lặng nên không có gì phải giữ.

### 13.8 Orb mờ dần **và** chậm dần

Kế hoạch lo rằng đổi `animation-duration` giữa chu kỳ sẽ gây giật. Giải được:
chỉ đổi tại sự kiện `animationiteration`, tức đúng ranh giới chu kỳ. Nên orb
giãn từ 10 s → 14 s ở cuối session mà không hề giật. Giữ được cả hai.

### 13.9 Thêm: tap Rest trước khi hydrate vẫn ra tiếng

Không có trong kế hoạch. Inline script trong `index.html` tự tạo `Audio` và gọi
`play()` **ngay trong gesture**, rồi engine "nhận nuôi" element đó khi bundle lên.
Nếu đợi React thì quyền autoplay đã hết và người dùng bấm vào im lặng. Đã test
bằng cách chặn bundle 1.5 s.

### 13.10 Lock-screen pause không làm lệch timer

MediaSession `pause` không chỉ tắt tiếng — nó đóng băng đồng hồ session, và khi
resume thì dịch cả `startedAt`/`endAt` lên, coi như khoảng thời gian pause chưa
từng xảy ra. Nếu không làm vậy, pause 20 phút rồi resume là session hết ngay.

### 13.11 Sai số kết thúc trên iOS là ±24 s, không phải ±5 s

Hệ quả trực tiếp của 13.2: app phải đợi vùng lull tới. Với sleep timer thì hoàn
toàn không sao, nhưng đây là con số thật, không phải con số trong kế hoạch.

---

## 14. Bổ sung sau MVP — Tiếng Việt

Kế hoạch chốt English only (mục 12). Sau khi MVP xong thì thêm tiếng Việt.

### 14.1 Không flash tiếng Anh — và đây là phần khó nhất

Shell tĩnh trong `index.html` là thứ paint đầu tiên, mà nó là HTML cứng bằng tiếng
Anh. Nếu để script sửa text sau khi shell đã render thì người Việt sẽ **thấy tiếng
Anh nhấp nháy một nhịp rồi mới đổi** — đúng kiểu chi tiết rẻ tiền mà lại phá cảm
giác cả sản phẩm.

Cách giải: shell chứa **cả hai ngôn ngữ** dưới dạng hai `<span>` cạnh nhau, và một
script đặt trong `<head>` set `html[lang]` **trước khi body được parse**. CSS ẩn
cặp không dùng:

```css
html[lang="vi"] [data-en], html:not([lang="vi"]) [data-vi] { display: none; }
```

Nên đến lúc paint thì lựa chọn đã xong rồi. Tốn ~200 byte HTML trùng lặp, đổi lại
không có nhịp nhấp nháy nào. Đã test bằng cách chặn bundle 1.5 s với `locale: vi-VN`.

### 14.2 Cue lưu theo **key**, không lưu câu

`scripts.ts` giờ chỉ giữ mốc thời gian + key; câu chữ nằm trong `src/i18n.ts`.
Nghĩa là hai ngôn ngữ có **nhịp giống nhau tuyệt đối**, và thêm ngôn ngữ thứ ba là
thêm một entry trong bảng, không phải sửa code.

### 14.3 Dịch theo tông, không dịch theo chữ

Bản tiếng Anh dựa trên sự **cho phép** ("you don't have to"). Dịch thẳng thành
"bạn không phải…" nghe như phủ định khô. Dùng **"chưa cần"** — vừa mềm hơn, vừa
đúng tinh thần cái tên *Later.*:

> Tối nay chưa cần tìm ra câu trả lời.

"Park a thought" → **"gác lại"**, vì "gác lại" đúng nghĩa tạm đặt xuống rồi lấy
lại sau, chứ không phải bỏ đi.

Tiếng Việt cũng dùng **đồng hồ 24 giờ** ("2:17" thay vì "2:17 AM") vì đó là cách
người Việt đọc giờ. Quy tắc này nằm ở hai chỗ (inline script và `clock.ts`) — có
comment nhắc nhau ở cả hai.

### 14.4 Chuyển ngôn ngữ nằm trong Picker

Không thêm surface mới. Picker giờ có 4 field thay vì 3, vẫn trong một màn hình.

Một chi tiết dễ sai: `composeLabel` phải compose theo **ngôn ngữ của draft**, không
theo context đang active. Nếu lấy từ context thì lúc đổi ngôn ngữ, nhãn được lưu
sẽ vẫn là ngôn ngữ cũ, và lần mở app sau shell sẽ in sai.

### 14.5 Nhãn mặc định phải khớp chính xác giữa shell và React

Shell in `Mưa · 20 phút`; `composeLabel(defaults())` phải ra **đúng chuỗi đó**,
không được thêm tên mode. Nếu lệch một ký tự là hydration làm chữ nhảy.

---

## 15. Bổ sung sau MVP — CI release lên GitHub Pages

`.github/workflows/deploy.yml`. Push vào `main` → build → publish. Bật một lần ở
**Settings → Pages → Source → GitHub Actions**.

### 15.1 GitHub Pages phục vụ project site ở `/<repo>/`, không phải root

Đây là cái bẫy thật của việc deploy lên Pages: **mọi đường dẫn absolute kiểu
`/audio/rain-base.m4a` sẽ 404** trên Pages, mà ở local thì trông hoàn hảo. Đúng
loại bug chỉ lộ ra ở production.

Đã làm base-aware toàn bộ:

| Chỗ | Cách |
|---|---|
| `index.html` (icon, inline audio path) | `%BASE_URL%` — Vite thay lúc build |
| `src/audio/layers.ts` (bed, thunder, icon) | `import.meta.env.BASE_URL` |
| Web manifest | Chuyển từ file tĩnh sang **plugin sinh**, để `start_url`/`scope`/icon tự lấy base |
| `navigateFallback` của service worker | `${base}index.html` |

Workflow tự suy ra prefix: nếu repo tên `<owner>.github.io` thì base là `/`, còn
lại là `/<repo>/`.

### 15.2 `scripts/check-base.mjs` — guard cho đúng loại bug đó

CI không chỉ build mà còn **grep lại output thật** tìm những gì còn absolute:
placeholder `%BASE_URL%` chưa được thay, `"/audio/`, `"/icons/`, `"/assets/`,
`start_url`/`scope` của manifest, `navigateFallback` trong `sw.js`, và sự tồn tại
của cả 9 asset. Đã verify bằng cách build thật với `BASE_PATH=/Later/`.

### 15.3 CI cũng enforce ngân sách bundle

`npm run size` chạy trong CI và **fail build** nếu JS vượt 60 KB gzip. Mở nhanh là
yêu cầu sản phẩm (mục 9), nên nó phải là điều kiện để ship, không phải việc để dành.

### 15.4 Không để CI tải binary ffmpeg 30 MB mỗi lần

`ffmpeg-static` chỉ cần cho `npm run audio`, mà asset đã commit sẵn. Postinstall
của nó bỏ qua download nếu `FFMPEG_BIN` trỏ tới một file có thật, nên CI set
`FFMPEG_BIN=/bin/true`.
