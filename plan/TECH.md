# Tech Stack

## Frontend

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15** (React 19, App Router) | SSR + SPA in one, counts as both frontend and backend framework for the 42 module |
| Language | **TypeScript** | Type safety across the stack |
| Styling | **Tailwind CSS 4** | Utility-first, fast iteration |
| Real-time | **Socket.IO client** | Live bet updates, chat, notifications |
| State | **Zustand** | Lightweight, no boilerplate |
| Forms | **React Hook Form + Zod** | Validation shared with backend schemas |

## Backend

| Layer | Choice | Why |
|---|---|---|
| Framework | **FastAPI** (Python 3.12) | Async, WebSocket-native, auto OpenAPI docs |
| Package mgr | **uv** | Fast Python dependency management |
| ORM | **SQLAlchemy 2** + Alembic | Async support, mature migrations |
| Database | **PostgreSQL 16** | JSONB for flexible bet metadata, strong concurrency |
| Cache / Pub-Sub | **Redis 7** | Session store, real-time event bus, rate limiting |
| Auth | **JWT** (access + refresh tokens) + **bcrypt** | Stateless auth with secure password hashing |
| Real-time | **Socket.IO server** (python-socketio) | Scalable WebSocket layer, rooms for bet threads |
| Task queue | **Celery + Redis** | Bet resolution scheduling, API data polling |

## Infrastructure

| Layer | Choice | Why |
|---|---|---|
| Containers | **Docker Compose** | Single `docker compose up` to run everything (with rootless docker)|
| Reverse proxy | **Nginx** | HTTPS termination, static file serving |
| Secrets | `.env` file (git-ignored) | 42 requirement; `.env.example` committed |


## 42 Module Point Calculation

The ft_transcendence subject v21.1 requires **14 module points**. Major modules count for **2 points** and minor modules count for **1 point**. The table below lists the subject modules that are relevant to Vox Populi's scope and whether this project currently appears to satisfy them.

| Category | Module | Type | Ticked | Counted pts | Evidence / note |
|---|---|---:|:---:|---:|---|
| Web | Use a framework for both frontend and backend | Major | Yes | 2 | Next.js frontend and FastAPI backend. |
| Web | Use a frontend framework | Minor | Yes | 0 | Covered by the major framework module, not counted separately. |
| Web | Use a backend framework | Minor | Yes | 0 | Covered by the major framework module, not counted separately. |
| Web | Real-time features using WebSockets or similar | Major | Yes | 2 | Socket.IO powers live market, balance, chat, friend, and notification updates. |
| Web | User interaction: chat, profiles, friends | Major | Yes | 2 | Direct messages, public profiles, friend requests, friends list, blocking. |
| Web | Public API with API key, rate limiting, docs, and 5+ endpoints | Major | Partial | 1 | The read-only [public API](plan/API.md) has 5+ documented endpoints and rate limiting; it is partial because it is anonymous/read-only rather than API-key-secured with POST/PUT/DELETE coverage. |
| Web | ORM for the database | Minor | Yes | 1 | SQLAlchemy 2 models and Alembic migrations. |
| Web | Complete notification system | Minor | Yes | 1 | Stored notifications, unread counts, mark-read/delete actions, and Socket.IO delivery. |
| Web | Real-time collaborative features | Minor | No | 0 | The app has real-time updates, but not shared editing/workspaces/collaborative drawing. |
| Web | Server-Side Rendering (SSR) | Minor | No | 0 | Next.js is present, but most pages are client components, so this is not claimed. |
| Web | Progressive Web App with offline support | Minor | No | 0 | No service worker, manifest, install flow, or offline mode is present. |
| Web | Custom-made design system with 10+ reusable components | Minor | No | 0 | There are reusable React components, but no documented design-system module is claimed. |
| Web | Advanced search with filters, sorting, pagination | Minor | Yes | 1 | Market list supports query search, description toggle, filters, sorting, and paginated loading. |
| Web | File upload and management system | Minor | No | 0 | Avatar upload exists, but not a general multi-type file management system. |
| Accessibility and Internationalization | Complete WCAG 2.1 AA accessibility compliance | Major | No | 0 | Not audited or documented as complete WCAG AA compliance. |
| Accessibility and Internationalization | Multiple languages, at least 3 | Minor | Yes | 1 | i18n dictionaries exist for English, French, and German with a locale switcher. |
| Accessibility and Internationalization | Right-to-left language support | Minor | No | 0 | No RTL language or mirrored layout support. |
| Accessibility and Internationalization | Additional browser support | Minor | Yes | 1 | Manually tested in Firefox, Opera, Brave, and Edge; all tested flows worked without browser-specific issues. |
| User Management | Standard user management and authentication | Major | Yes | 2 | Secure signup/login, profile pages, profile editing, avatar upload, friends, and online status. |
| User Management | Game statistics and match history | Minor | No | 0 | Vox Populi is not a game project. |
| User Management | Remote authentication with OAuth 2.0 | Minor | Yes | 1 | Google, GitHub, and 42 OAuth 2.0 routes and UI are implemented. |
| User Management | Advanced permissions system | Major | No | 0 | No admin/moderator role CRUD system is present. |
| User Management | Organization system | Major | No | 0 | No organization CRUD or organization membership system. |
| User Management | Two-Factor Authentication | Minor | No | 0 | No 2FA flow is present. |
| User Management | User activity analytics and insights dashboard | Minor | Yes | 1 | Profile pages show the user's full betting history, created markets, positions, transactions, and reputation balances. |
| Artificial Intelligence | AI opponent for games | Major | No | 0 | Vox Populi is not a game project. |
| Artificial Intelligence | Complete RAG system | Major | No | 0 | No retrieval-augmented knowledge base or dataset Q&A system. |
| Artificial Intelligence | Complete LLM system interface | Major | Yes | 2 | OpenRouter and custom provider integration support summaries and resolution hints, with rate limits and budget controls. |
| Artificial Intelligence | Recommendation system using machine learning | Major | No | 0 | No ML recommendation engine is present. |
| Artificial Intelligence | Content moderation AI | Minor | No | 0 | No automatic moderation/deletion/warning pipeline. |
| Artificial Intelligence | Voice/speech integration | Minor | No | 0 | No voice or speech features. |
| Artificial Intelligence | Sentiment analysis | Minor | No | 0 | No sentiment analysis of user content. |
| Artificial Intelligence | Image recognition and tagging | Minor | No | 0 | No image recognition pipeline. |
| Cybersecurity | Hardened WAF/ModSecurity plus HashiCorp Vault | Major | No | 0 | HTTPS/security headers exist, but there is no ModSecurity/WAF plus Vault setup. |
| Devops | ELK log management | Major | No | 0 | No Elasticsearch, Logstash, or Kibana stack. |
| Devops | Prometheus and Grafana monitoring | Major | No | 0 | No Prometheus/Grafana monitoring stack. |
| Devops | Backend as microservices | Major | No | 0 | Backend is a FastAPI service with workers, not split into independently scoped microservices. |
| Devops | Health/status page, automated backups, disaster recovery | Minor | No | 0 | Docker health checks exist, but no complete status page, backup automation, and disaster recovery procedure. |
| Data and Analytics | Advanced analytics dashboard with visualization | Major | No | 0 | No advanced analytics dashboard. |
| Data and Analytics | Data export and import functionality | Minor | No | 0 | GDPR export exists, but not general import/export in multiple formats. |
| Data and Analytics | GDPR compliance features | Minor | Yes | 1 | User data export and account deletion/pseudonymization are implemented. |
| Modules of choice | Custom module: reputation-based prediction market economy and dispute resolution | Major | Yes | 2 | Like/Betting/Truth Points, capped stake influence, automated/proposer/community resolution, disputes, and payout logic are central custom features. |
| Modules of choice | Custom module: responsive web design optimized for mobile | Minor | Yes | 1 | The application is optimized for mobile and desktop layouts and has been manually validated as usable on small screens. |

### Result

| Count | Points |
|---|---:|
| Conservative, non-custom modules | 19 |
| Custom module candidates | +3 |
| **Total claimed** | **22** |
| Required by subject | 14 |
| Buffer above requirement | +8 |
