## Community Feature Plan

This is a large feature set. I recommend building it in phases:

### Phase 1: Public Garden Profiles
- Add `is_public` boolean to `plants` table + `garden_bio` to `profiles`
- Create `/community` page showing public gardens
- Create `/garden/:userId` public view of a user's garden
- RLS policies: public plants visible to all, private only to owner

### Phase 2: Social Feed + Interactions
- New `community_posts` table (user_id, plant_id, content, image_url, created_at)
- New `post_likes` table (user_id, post_id)
- New `post_comments` table (user_id, post_id, content)
- Feed page with infinite scroll, like/comment buttons
- Users can post plant updates from their plant detail page

### Phase 3: Plant Marketplace
- New `marketplace_listings` table (plant_id, price, currency, listing_type: trade/sale, status, description)
- Browse/filter marketplace listings
- Contact seller via in-app messaging or displayed contact info
- Mark listings as sold/traded

### Phase 4: Knowledge Sharing
- New `questions` table + `answers` table
- Tag system for plant-related topics
- Upvote/downvote on answers
- Mark best answer
- Search and filter questions

### Database tables needed (all phases):
~6 new tables with full RLS policies

### Estimated scope:
- Phase 1: ~3 components, 1 migration
- Phase 2: ~5 components, 1 migration  
- Phase 3: ~4 components, 1 migration
- Phase 4: ~5 components, 1 migration

Shall I start with Phase 1 (Public Garden Profiles)?