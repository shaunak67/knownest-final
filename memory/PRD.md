# knowNest - Product Requirements Document

## Overview
knowNest is a comprehensive mobile knowledge platform providing essential information across five key domains: First Aid, Finance, Crisis Management, Civic Sense, and Safety Tips. The app features YouTube video integration, Google authentication, offline access, and a clean, accessible interface.

## Tech Stack
- **Frontend**: React Native (Expo SDK 54) with expo-router
- **Backend**: FastAPI (Python)
- **Database**: MongoDB (motor async driver)
- **Auth**: Emergent Google OAuth
- **Video**: YouTube Data API v3
- **Storage**: AsyncStorage for offline access

## Features Implemented
### Core Features
1. **Category Browser** - 5 categories with images, icons, and topic counts
2. **Topic Detail** - Comprehensive content with descriptions, tags, and YouTube video guides
3. **YouTube Integration** - Live video search via YouTube Data API v3 for each topic
4. **Search** - Real-time search across all topics with debounced queries
5. **Google Auth** - Emergent-managed Google social login
6. **Bookmarks** - Save topics for offline access (requires authentication)
7. **Offline Access** - Cached topics and bookmarks via AsyncStorage
8. **Auto Theme** - Respects system light/dark mode preference

### Screens
- **Login** - Google auth + guest browsing option
- **Home** - Hero banner, category grid, quick access cards
- **Search** - Search bar with popular suggestions
- **Bookmarks** - Saved topics with remove functionality
- **Profile** - User info, menu options, logout
- **Category Detail** - Topics list with header banner
- **Topic Detail** - Content, tags, YouTube video guides

## Data Model
### Categories (5 total)
- First Aid, Finance, Crisis Management, Civic Sense, Safety Tips

### Topics (22 total)
- CPR, Burns, Choking, Bleeding, Fractures
- Income Tax, PAN Card, Banking, Budgeting, Insurance
- Self Defense, Fire Safety, Earthquake, Flood Survival
- Voting, RTI, Traffic Rules, Public Hygiene
- Road Safety, Cyber Safety, Food Safety, Home Safety

## API Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/categories | No | List all categories |
| GET | /api/categories/:slug | No | Category detail with topics |
| GET | /api/topics/:id | No | Topic with YouTube videos |
| GET | /api/search?q= | No | Search topics |
| POST | /api/auth/session | No | Exchange session_id for token |
| GET | /api/auth/me | Yes | Current user info |
| POST | /api/auth/logout | Yes | Logout |
| POST | /api/bookmarks | Yes | Add bookmark |
| DELETE | /api/bookmarks/:topic_id | Yes | Remove bookmark |
| GET | /api/bookmarks | Yes | List user bookmarks |

## Integrations
- **YouTube Data API v3**: Key stored in backend .env
- **Emergent Google Auth**: No additional keys needed

## Business Enhancement
- **Monetization**: Premium content tiers or ad-supported model for advanced guides
- **Engagement**: Push notifications for emergency tips and seasonal reminders
