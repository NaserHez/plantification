
## Scope

Seven workstreams, sequenced so schema lands first and UI follows.

---

### 1. Auth polish

- After successful `signUp`, show a full-card "Check your inbox" screen in `AuthForm.tsx` with the target email, a **Resend verification email** button (`supabase.auth.resend({ type: 'signup', email })`) with a 60s cooldown, and a "Wrong email? Start over" link.
- Friendlier error copy on `/reset-password` when the recovery link is missing/expired: show an inline card with **Send a new reset link** and a **Contact support** mailto fallback.
- Detect `?error=...` / `error_description` in the URL hash on auth pages and surface a clear message instead of a silent failure.

### 2. Care schedules v2

New table `care_schedules` (one row per plant × task type):

```text
care_schedules
  id, plant_id, user_id, task_type ('water'|'fertilize'|'mist'|'repot'),
  interval_days, next_due_at, last_done_at, is_paused, notes
```

- Seed defaults per species using the existing AI care instructions (fallback table for common species).
- Seasonal auto-adjust: multiplier by month (summer 0.8×, winter 1.4× for watering/misting) applied when computing `next_due_at`.
- UI: `PlantDetailPage` gets a **Care schedule** panel with per-task rows — edit interval, **Skip once**, **Postpone 3d**, **Mark done**, **Pause**.
- Bulk actions in `GardenPage`: multi-select plants → **Water all selected**, **Snooze 1 day**, **Duplicate plant**.
- Notifications page groups by task type in addition to location.

### 3. Light meter diagnostic

- New route `/light-meter` (also embedded on `PlantDetailPage`).
- Uses `getUserMedia({ video: { facingMode: 'environment' } })`, samples frames onto a hidden canvas, converts RGB → luminance (`0.2126R + 0.7152G + 0.0722B`), calibrates against camera exposure metadata when available, and returns an estimated lux bucket: Low / Medium / Bright / Direct sun.
- Saves reading to `plants.last_light_reading` + `last_light_at`; compares against species light requirement and shows a verdict ("Too dark for a Calathea — move closer to a window").
- Fallback for devices without camera: manual slider.

### 4. Shared gardens (everyone equal)

New tables:

```text
shared_gardens          id, owner_id, name, invite_code (unique, short)
shared_garden_members   garden_id, user_id, joined_at   (PK: garden_id,user_id)
```

- `plants.shared_garden_id` nullable FK. RLS: a plant is readable/writable if `user_id = auth.uid()` OR the user is a member of its `shared_garden_id`.
- Security-definer helper `public.is_garden_member(_garden uuid, _user uuid)` to avoid recursive RLS.
- UI in Settings → **Shared gardens**: create garden, share invite link (`/join/:code`), member list with **Leave** / **Remove** (owner only for remove; everyone can edit plants).
- Watering push notifications fan out to every member of a plant's shared garden.

### 5. Gamification

- Streak counter on profile (`current_streak`, `longest_streak`) incremented when the user completes any care task on a day.
- Badges table + earned events (`first_plant`, `7_day_streak`, `10_plants`, `identified_10`, `saved_a_wilter`).
- `PlantCard` shows a **wilting** visual state (desaturated + drooping-leaf icon) when a plant is >2× its watering interval overdue; returns to normal after care is logged.
- New **Achievements** section in Settings.

### 6. Onboarding tour

- First-login detection via `profiles.onboarded_at`.
- Lightweight custom tour (no new dependency): 4 steps using shadcn `Popover` anchored to `#tour-add-plant`, `#tour-identify`, `#tour-schedule`, `#tour-notifications`, with **Next / Skip / Done**. Dismissible; re-launchable from Settings → **Replay tour**.
- Contextual tooltips (`<Tooltip>`) on the bottom-nav icons.

### 7. Accessibility & consistency pass

- Audit color tokens in `index.css` for WCAG AA (fix any `text-muted-foreground` on `bg-muted` failures).
- Font-size setting in Settings (`sm | md | lg`) that toggles a root class controlling `--font-scale`; applied via `html { font-size: calc(16px * var(--font-scale)) }`.
- Add visible text labels next to icon-only actions in bottom nav ("Garden", "Identify", "Chat", "More"); ensure all icon buttons have `aria-label`.
- Replace ambiguous CTAs: "Send" → "Identify plant", "Go" → "Start diagnosis", etc.
- Add `<main>` landmark on each page, single `h1`, and `lang` attribute from `LanguageContext`.

---

## Delivery order

1. **Migration batch A** — `care_schedules`, `shared_gardens`, `shared_garden_members`, `badges`, `user_badges`, columns on `plants`/`profiles` (`shared_garden_id`, `last_light_reading`, `onboarded_at`, `current_streak`, `longest_streak`), RLS + grants + `is_garden_member` helper.
2. **Auth polish** (frontend only, no schema).
3. **Care schedules v2** UI + edge function update to `send-watering-reminders` to read from `care_schedules`.
4. **Shared gardens** UI + invite route + RLS verification.
5. **Light meter** page/component + saving readings.
6. **Gamification** hooks (streak on care-done, badge grants) + `PlantCard` wilt state.
7. **Onboarding tour** + tooltips.
8. **A11y & label pass** across pages.

## Technical notes

- Seasonal multiplier lives in a shared util `src/lib/care-schedule.ts` (pure function, unit-testable).
- Light meter luminance sampling is client-only; no edge function.
- Shared garden invite codes: 8-char base32, generated in DB via `substring(md5(random()::text), 1, 8)`.
- Font-scale setting persisted in `localStorage` (no schema needed).
- Badges granted via database trigger on `journal_entries` INSERT so grants are atomic and can't be spoofed from the client.

## Out of scope this round

- Push-notification delivery for shared-garden co-members beyond the owner's subscriptions (v1 sends to everyone's `push_subscriptions` — no per-member preferences yet).
- Species light-requirement dataset beyond what the AI care instructions already provide (bucketed heuristics only).
- Multi-language onboarding tour copy — English + Arabic + Portuguese strings will be added via existing `translations.ts`.
