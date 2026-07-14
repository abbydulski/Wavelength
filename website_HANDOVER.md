# Wavelength — Project Handover & Rebuild Guide

> Handover for starting a fresh, sleeker version of Wavelength. Same product,
> cleaner build. This documents what exists today, what to keep, and what to
> improve.

## 1. Product Vision

**Wavelength** is a friends-first social app for sharing and rating real-world
experiences (places, food, travel, etc.) within ~100 miles. The anti-thesis of
algorithmic short-form feeds: you see posts from people you actually follow,
each with a rating (1–10), photos, a location, and a category. Others can
**agree/disagree** with a rating and comment.

Core loop: *follow friends → see their rated posts → discover useful places you
can trust.*

## 2. Current Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 15 (App Router) | Every page is `'use client'` — effectively an SPA |
| UI | React 19 + Tailwind CSS 4 | Heavy indigo→purple→fuchsia gradient theme |
| Backend | Supabase | Postgres + Auth + Storage + Realtime |
| Maps | Leaflet + react-leaflet | Discover map of public posts |
| Icons | @heroicons/react + inline SVG | |
| Analytics | @vercel/analytics | |

## 3. Feature Inventory (what works today)

- **Auth**: email/password signup + login, password reset (Supabase Auth).
- **Feed** (`/`): posts from you + people you follow, category filter chips,
  realtime refresh, per-post agree/disagree + rating badge.
- **Create** (`/create`): caption, rating (1–10), category, location +
  coordinates, up to 3 photos → Supabase Storage, public/private toggle.
- **Discover** (`/discover`): Leaflet map of public posts by coordinates.
- **Search** (`/search`): find users by name.
- **Profiles**: own (`/profile`) + others (`/user/[id]`), follow / follow
  requests, follower/following counts.
- **Post detail** (`/post/[id]`): full post, comments, reactions.
- **Follow requests**: request/accept flow with realtime pending-count badge.
- **Feedback** (`/feedback`), **Settings** (`/settings`), **Privacy/Terms** pages.

## 4. Data Model (Supabase / Postgres)

See `supabase-schema.sql` for the authoritative version. Tables:

- `users` — profile (extends `auth.users`): `display_name`, `email`, `bio`,
  `photo_url`, `posts_count`. Auto-created on signup via `handle_new_user()`
  trigger.
- `posts` — `caption`, `rating` (1–10 check), `category`, `location`,
  `coordinates` (JSONB `{latitude, longitude}`), `photos` (TEXT[]),
  `is_public`, `agreed_by`/`disagreed_by` (UUID[]).
- `comments` — per-post, denormalized `username`/`user_avatar`.
- `follows` — `follower_id` → `following_id` (unique, no self-follow).
- `follow_requests` — `from_user_id` → `to_user_id`.
- `feedback` — free text.

**Storage buckets** (create manually, set public): `avatars`, `posts`.

**RLS**: enabled on all tables. Public posts visible to all; private posts only
to owner + followers. Users edit only their own rows.

## 5. Key Architecture Notes & Gotchas

- **`lib/supabase.js`** creates the singleton client from
  `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. It **throws** if
  they're missing — so the app is dead without `.env.local`.
- **`hooks/useAuth.js`** is a large context provider holding almost all business
  logic (auth, follow, reactions, comments, follow requests). ~380 lines. Prime
  candidate for splitting in the rebuild.
- **Denormalization**: `posts`/`comments` store `username` + `user_avatar`
  copies. Fast reads, but stale if a user renames. Consider joins/views instead.
- **snake_case ↔ camelCase**: DB is snake_case; components manually remap to
  camelCase everywhere (see `Feed.js`). Error-prone boilerplate — centralize
  mappers or use generated types.
- **Realtime**: Feed and follow-request count subscribe to `postgres_changes`
  with 500ms debounce + refetch (not incremental patching).
- **Auth state is duplicated**: both `Layout.js` and `useAuth.js` independently
  subscribe to `onAuthStateChange`. Consolidate.
- `Feed.js` header comment literally says "we'll make these fancier later" —
  reaction/rating UI is placeholder-grade.

## 6. What to KEEP for v2

- The Supabase schema + RLS design (solid foundation).
- The core product model: follow → rated posts → agree/disagree → discover.
- Category taxonomy (food, travel, fun, shopping, fitness, work, social, other).
- The `handle_new_user()` trigger pattern for profile creation.

## 7. What to IMPROVE for a "sleeker" v2

- **Design system**: replace the loud tri-color gradient with a restrained,
  modern palette + consistent spacing/typography tokens. Build reusable
  primitives (Button, Card, Avatar, Badge, RatingPill).
- **State/data layer**: adopt TanStack Query or SWR for caching + optimistic
  updates instead of manual `useState` + full refetch.
- **Types**: use TypeScript + Supabase-generated types to kill the manual
  snake/camel remapping.
- **Break up `useAuth`**: separate auth from social actions (follows,
  reactions, comments) into focused hooks/services.
- **Mobile-first**: bottom tab bar, safe-area padding, touch targets — needed
  anyway for the eventual App Store (Capacitor) wrap.
- **Realtime**: patch state incrementally instead of debounced refetch.
- **Images**: consistent aspect ratios, blur placeholders, compression on
  upload.

## 8. Path to App Store (future)

App is fully client-side → ideal for **Capacitor** (wrap the web build in a
native iOS/Android shell Apple accepts). Requires: Next.js static export, a Mac
with Xcode, and an Apple Developer account ($99/yr). Design mobile-first now to
avoid rework later.

## 9. First-Run Setup (for reference)

1. `npm install`
2. Create a Supabase project; run `supabase-schema.sql` in the SQL editor.
3. Create public Storage buckets: `avatars`, `posts`.
4. Create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (never commit; keep out of chat/logs).
5. `npm run dev` → verify signup → create post → feed → map.

## 10. Reference Files

- `supabase-schema.sql` — full DB schema, RLS, trigger.
- `SUPABASE_SETUP.md` — original Supabase setup walkthrough.
- `MIGRATION_SUMMARY.md` — Firebase → Supabase migration record.
- `hooks/useAuth.js`, `components/{Feed,Layout,DiscoverMap}.js` — core logic.
