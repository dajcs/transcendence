"""Dev seed script.

Creates 8 test users with markets, bets, upvotes, comments, friend relations,
and direct chat messages.
Password == username (bypasses API validation — direct DB insert).

Run via: make seed
Or: docker compose exec -e PYTHONPATH=/app backend uv run python scripts/seed_dev.py

Safe to run multiple times — skips existing users/markets.

Note:
discard DB data:

docker compose down -v

to stop and remove compose stack + volumes
"""
import asyncio
import json
import random
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.db.models.bet import Bet, BetPosition, BetUpvote, Comment, CommentUpvote
from app.db.models.social import FriendRequest, Message
from app.db.models.transaction import BpTransaction, LpEvent
from app.db.models.user import User
from app.db.session import AsyncSessionLocal
from app.utils.password import hash_password

random.seed(42)

TODAY = datetime.now(timezone.utc).date()
SEED_BP_AMOUNT = 11.0
SEED_LP_AMOUNT = 100

# Deadlines: a few minutes out, a few hours out, a few days out
DEADLINE_OFFSETS = [
    timedelta(minutes=5),
    timedelta(minutes=10),
    timedelta(hours=2),
    timedelta(hours=6),
    timedelta(days=1),
    timedelta(days=3),
    timedelta(days=5),
]

SEED_USERS = [
    {"username": "alice",  "email": "alice@example.com"},
    {"username": "bob",    "email": "bob@example.com"},
    {"username": "claude", "email": "claude@example.com"},
    {"username": "dave",   "email": "dave@example.com"},
    {"username": "eve",    "email": "eve@example.com"},
    {"username": "faust",  "email": "faust@example.com"},
    {"username": "gina",   "email": "gina@example.com"},
    {"username": "hugo",   "email": "hugo@example.com"},
]

# Each user gets 2-3 accepted friends via these pairs.
# alice: bob, claude, gina (3)   bob: alice, dave, hugo (3)
# claude: alice, eve (2)         dave: bob, faust (2)
# eve: claude, gina (2)          faust: dave, hugo (2)
# gina: alice, eve (2)           hugo: bob, faust (2)
FRIEND_PAIRS = [
    ("alice", "bob"),
    ("alice", "claude"),
    ("alice", "gina"),
    ("bob", "dave"),
    ("bob", "hugo"),
    ("claude", "eve"),
    ("dave", "faust"),
    ("eve", "gina"),
    ("faust", "hugo"),
]

# 3-4 messages per pair, alternating sender
CHAT_SCRIPTS: dict[tuple[str, str], list[tuple[str, str]]] = {
    ("alice", "bob"): [
        ("alice", "Hey, did you see that new AI coding benchmark?"),
        ("bob",   "Yeah, crazy numbers. I bet it breaks TIOBE top 5 within a year."),
        ("alice", "That's what my market is about! Already got 4 positions on it."),
        ("bob",   "Nice. I threw in a no — incumbents don't move that fast."),
    ],
    ("alice", "claude"): [
        ("claude", "Your social media shutdown market is interesting."),
        ("alice",  "Right? Twitter almost qualified in 2023. One big platform feels inevitable."),
        ("claude", "I'm hedging yes. Too much VC pressure on the smaller ones."),
    ],
    ("alice", "gina"): [
        ("alice", "How are you tracking the open-source LLM race?"),
        ("gina",  "Closely. Llama 4 already nips at GPT-4 on some subsets."),
        ("alice", "So you're bullish on your market resolving yes?"),
        ("gina",  "Yep. Staked accordingly."),
    ],
    ("bob", "dave"): [
        ("bob",   "Quantum 1000-qubit by 2027 — that's a bold call."),
        ("dave",  "IBM already announced 1000+ but stability is the hard part."),
        ("bob",   "Fair. I'm leaning no on the stability criterion."),
    ],
    ("bob", "hugo"): [
        ("hugo", "Remote work at 50% of tech jobs — I think we're almost there."),
        ("bob",  "LinkedIn data says otherwise. Lots of return-to-office pressure."),
        ("hugo", "Short-term noise. Long-term trend is clear."),
        ("bob",  "We'll settle this at resolution time then."),
    ],
    ("claude", "eve"): [
        ("eve",    "Robotaxi in 5+ cities by 2027 feels optimistic."),
        ("claude", "Waymo is already in 3. One more plus an international launch could do it."),
        ("eve",    "Regulatory approval timelines are brutal though."),
    ],
    ("dave", "faust"): [
        ("faust", "New language in TIOBE top 10 — I'm thinking Zig or Mojo."),
        ("dave",  "Mojo could ride the AI wave. But 2027 is tight."),
        ("faust", "Agreed, tight. But the hype cycle is faster than ever."),
        ("dave",  "Staked a small yes just in case."),
    ],
    ("eve", "gina"): [
        ("gina", "Your systems programming market — I voted Rust obviously."),
        ("eve",  "Same. Though Go is quietly eating a lot of that space."),
        ("gina", "Go is too garbage-collected for 'systems' purists."),
    ],
    ("faust", "hugo"): [
        ("hugo",  "Which company for most impactful AI release? I went Anthropic."),
        ("faust", "I went DeepMind — they've been quietly crushing benchmarks."),
        ("hugo",  "Fair. Anthropic has the safety narrative though, more citations."),
        ("faust", "We'll see. May the best model win."),
    ],
}

# 3 baseline markets per user (binary, multiple_choice, numeric)
MARKET_TEMPLATES = [
    # ── alice ──────────────────────────────────────────────────────────────────
    {
        "proposer": "alice",
        "market_type": "binary",
        "title": "Will AI surpass human-level coding ability by end of 2026?",
        "description": "Measured by performance on competitive programming benchmarks (Codeforces, LeetCode hard).",
        "resolution_criteria": "An AI system scores in the top 1% of human participants on Codeforces by Dec 31 2026.",
    },
    {
        "proposer": "alice",
        "market_type": "multiple_choice",
        "title": "Best backend framework for new projects in 2026?",
        "description": "Community consensus based on GitHub stars, job postings, and developer surveys.",
        "resolution_criteria": "StackOverflow Developer Survey 2026 most-used backend framework.",
        "choices": ["FastAPI", "Django", "Express", "Rails", "Spring Boot"],
    },
    {
        "proposer": "alice",
        "market_type": "numeric",
        "title": "How many AI models with >1B parameters will be publicly released in 2026?",
        "description": "Count of distinct models released on HuggingFace with >1B params.",
        "resolution_criteria": "HuggingFace model count filtered by param size at Dec 31 2026.",
        "numeric_min": 50.0,
        "numeric_max": 2000.0,
    },
    # ── bob ────────────────────────────────────────────────────────────────────
    {
        "proposer": "bob",
        "market_type": "binary",
        "title": "Will Rust overtake Python in the TIOBE index by 2027?",
        "description": "TIOBE measures programming language popularity based on web searches.",
        "resolution_criteria": "Rust rank > Python rank in TIOBE index January 2027 edition.",
    },
    {
        "proposer": "bob",
        "market_type": "multiple_choice",
        "title": "Which cloud provider will lead AI workloads in 2026?",
        "description": "Measured by market share of GPU/TPU cloud compute for AI training.",
        "resolution_criteria": "Synergy Research Group Q4 2026 cloud AI infrastructure report.",
        "choices": ["AWS", "Google Cloud", "Azure", "Oracle Cloud"],
    },
    {
        "proposer": "bob",
        "market_type": "numeric",
        "title": "Python packages on PyPI by end of 2026 (thousands)?",
        "description": "Total package count on pypi.org on Dec 31 2026.",
        "resolution_criteria": "PyPI stats page total package count on Dec 31 2026.",
        "numeric_min": 500.0,
        "numeric_max": 1200.0,
    },
    # ── claude ─────────────────────────────────────────────────────────────────
    {
        "proposer": "claude",
        "market_type": "binary",
        "title": "Will a major social media platform (>100M users) shut down in 2026?",
        "description": "Includes platforms ceasing operations or being acquired and discontinued.",
        "resolution_criteria": "Platform with >100M MAU ceases operations or fully merges before Dec 31 2026.",
    },
    {
        "proposer": "claude",
        "market_type": "multiple_choice",
        "title": "Most popular frontend framework in the 2027 StackOverflow survey?",
        "description": "StackOverflow annual developer survey most-used web framework category.",
        "resolution_criteria": "StackOverflow Developer Survey 2027 most-used frontend framework.",
        "choices": ["React", "Vue", "Angular", "Svelte", "SolidJS"],
    },
    {
        "proposer": "claude",
        "market_type": "numeric",
        "title": "GitHub public repository count at end of 2026 (millions)?",
        "description": "Total public repositories on GitHub.com on December 31 2026.",
        "resolution_criteria": "GitHub Octoverse report total public repository count for 2026.",
        "numeric_min": 300.0,
        "numeric_max": 800.0,
    },
    # ── dave ───────────────────────────────────────────────────────────────────
    {
        "proposer": "dave",
        "market_type": "binary",
        "title": "Will quantum computing achieve 1000-qubit stable operation by 2027?",
        "description": "Stable = sustained computation with error rate below 0.1% per gate.",
        "resolution_criteria": "Peer-reviewed paper or press release from IBM/Google/IonQ by Jan 2027.",
    },
    {
        "proposer": "dave",
        "market_type": "multiple_choice",
        "title": "Which database will dominate microservices architectures in 2026?",
        "description": "Based on usage in new projects, job postings, and community adoption.",
        "resolution_criteria": "DB-Engines most-used database in cloud-native/microservices category.",
        "choices": ["PostgreSQL", "MongoDB", "Redis", "CockroachDB", "PlanetScale"],
    },
    {
        "proposer": "dave",
        "market_type": "numeric",
        "title": "VS Code extensions available on marketplace by end of 2026 (thousands)?",
        "description": "Total extension count on marketplace.visualstudio.com on Dec 31 2026.",
        "resolution_criteria": "VS Code marketplace extension count on Dec 31 2026.",
        "numeric_min": 45.0,
        "numeric_max": 150.0,
    },
    # ── eve ────────────────────────────────────────────────────────────────────
    {
        "proposer": "eve",
        "market_type": "binary",
        "title": "Will self-driving robotaxis operate commercially in 5+ cities by end of 2027?",
        "description": "Commercial = paid rides to the general public without a safety driver.",
        "resolution_criteria": "5+ cities with fully driverless commercial robotaxi service by Dec 31 2027.",
    },
    {
        "proposer": "eve",
        "market_type": "multiple_choice",
        "title": "Best language for systems programming in 2026?",
        "description": "Community vote on safety, performance, and ecosystem maturity.",
        "resolution_criteria": "StackOverflow 2026 most-loved systems programming language.",
        "choices": ["Rust", "Go", "C++", "Zig", "Carbon"],
    },
    {
        "proposer": "eve",
        "market_type": "numeric",
        "title": "React weekly npm downloads by end of 2026 (millions per week)?",
        "description": "Weekly download count for the react package on npmjs.com.",
        "resolution_criteria": "npm stats for react package in the last week of December 2026.",
        "numeric_min": 15.0,
        "numeric_max": 80.0,
    },
    # ── faust ──────────────────────────────────────────────────────────────────
    {
        "proposer": "faust",
        "market_type": "binary",
        "title": "Will a new programming language enter the TIOBE top 10 by 2027?",
        "description": "A language not currently in the top 10 as of Jan 2026.",
        "resolution_criteria": "TIOBE January 2027: a language not in Jan 2026 top 10 appears in the top 10.",
    },
    {
        "proposer": "faust",
        "market_type": "multiple_choice",
        "title": "Which company will have the most impactful AI release in 2026?",
        "description": "Impact measured by media coverage, research citations, and industry adoption.",
        "resolution_criteria": "Most cited AI model/system in research papers published in 2026.",
        "choices": ["Anthropic", "OpenAI", "Google DeepMind", "Meta AI", "Mistral"],
    },
    {
        "proposer": "faust",
        "market_type": "numeric",
        "title": "Stack Overflow questions asked in 2026 (millions)?",
        "description": "Total new questions posted on Stack Overflow during calendar year 2026.",
        "resolution_criteria": "Stack Overflow annual report total questions for 2026.",
        "numeric_min": 8.0,
        "numeric_max": 40.0,
    },
    # ── gina ───────────────────────────────────────────────────────────────────
    {
        "proposer": "gina",
        "market_type": "binary",
        "title": "Will open-source LLMs match GPT-4 quality on MMLU benchmark by end of 2026?",
        "description": "Open-source = freely downloadable weights, no API required.",
        "resolution_criteria": "An open-source model scores >= GPT-4 on MMLU benchmark by Dec 31 2026.",
    },
    {
        "proposer": "gina",
        "market_type": "multiple_choice",
        "title": "Most impactful AI application area in 2026?",
        "description": "Where AI will have the largest measurable real-world impact this year.",
        "resolution_criteria": "McKinsey Global Institute AI report 2026 highest-impact sector.",
        "choices": ["Healthcare", "Education", "Finance", "Transportation", "Entertainment"],
    },
    {
        "proposer": "gina",
        "market_type": "numeric",
        "title": "Docker Hub image pulls in 2026 (billions)?",
        "description": "Total pull count across all Docker Hub images during 2026.",
        "resolution_criteria": "Docker annual report total image pulls for 2026.",
        "numeric_min": 100.0,
        "numeric_max": 1000.0,
    },
    # ── hugo ───────────────────────────────────────────────────────────────────
    {
        "proposer": "hugo",
        "market_type": "binary",
        "title": "Will remote work be standard for 50%+ of tech jobs by 2027?",
        "description": "Standard = offered as default option, not exceptional perk.",
        "resolution_criteria": "LinkedIn Job Trends 2027: 50%+ of software engineering jobs list remote as default.",
    },
    {
        "proposer": "hugo",
        "market_type": "multiple_choice",
        "title": "Which OS will gain most developer market share by 2027?",
        "description": "Measured by StackOverflow Developer Survey OS usage.",
        "resolution_criteria": "StackOverflow Developer Survey 2027: largest year-over-year market share gain.",
        "choices": ["Linux", "macOS", "Windows", "ChromeOS"],
    },
    {
        "proposer": "hugo",
        "market_type": "numeric",
        "title": "Number of programming languages with >1M active users by 2027?",
        "description": "Active = used professionally by at least 1 million developers.",
        "resolution_criteria": "RedMonk or similar survey count of languages with >1M professional users.",
        "numeric_min": 8.0,
        "numeric_max": 35.0,
    },
    # ── weather / auto-resolution coverage ────────────────────────────────────
    {
        "proposer": "alice",
        "market_type": "binary",
        "title": "Will it rain in Paris at the next market deadline?",
        "description": "Weather auto-resolution smoke market for rain.",
        "resolution_criteria": "Open-Meteo current weather reports rain in Paris at resolution time.",
        "resolution_source": {"provider": "open-meteo", "location": "Paris", "condition": "rain"},
    },
    {
        "proposer": "bob",
        "market_type": "binary",
        "title": "Will it snow in Berlin at the next market deadline?",
        "description": "Weather auto-resolution smoke market for snow.",
        "resolution_criteria": "Open-Meteo current weather reports snow in Berlin at resolution time.",
        "resolution_source": {"provider": "open-meteo", "location": "Berlin", "condition": "snow"},
    },
    {
        "proposer": "gina",
        "market_type": "numeric",
        "title": "What temperature will Paris report at the next market deadline?",
        "description": "Weather auto-resolution smoke market for temperature.",
        "resolution_criteria": "Open-Meteo current temperature in Paris at resolution time.",
        "numeric_min": -10.0,
        "numeric_max": 40.0,
        "resolution_source": {"provider": "open-meteo", "location": "Paris", "condition": "temperature"},
    },
    {
        "proposer": "hugo",
        "market_type": "numeric",
        "title": "What wind speed will Luxembourg City report at the next market deadline?",
        "description": "Weather auto-resolution smoke market for wind speed.",
        "resolution_criteria": "Open-Meteo current wind speed in Luxembourg City at resolution time.",
        "numeric_min": 0.0,
        "numeric_max": 160.0,
        "resolution_source": {"provider": "open-meteo", "location": "Luxembourg", "condition": "wind"},
    },
]

COMMENT_POOL = [
    "Strong yes from me — the trend is undeniable at this point.",
    "I'm skeptical. The last three years of hype haven't delivered.",
    "This is basically a coin flip. I'll go with the optimistic side.",
    "The numbers support this. Look at the growth rate over the past 18 months.",
    "People are underestimating the regulatory headwinds here.",
    "Classic overconfidence in the market. Reality rarely matches expectations.",
    "I've been following this space closely — highly likely in my view.",
    "The incumbents have too much to lose. They'll block this.",
    "Open-source momentum is real. Don't underestimate the community.",
    "My estimate is based on linear extrapolation of current trends.",
    "Too many unknowns. I'm hedging with a conservative position.",
    "The conference talks from last year suggest this is closer than people think.",
    "Interesting market. I'll wait for more data before committing fully.",
    "The benchmark numbers are already trending in this direction.",
    "History says no, but this cycle feels different.",
    "Funding alone isn't enough — execution matters here.",
    "The developer adoption curve is S-shaped. We're past the inflection point.",
    "Hard to resolve this objectively. The criteria need more clarity.",
    "I've seen this pattern before. Usually takes 2x longer than expected.",
    "Bullish. The pieces are finally in place.",
]


async def _ensure_seed_balances(db, user: User) -> None:
    seed_bp_exists = (
        await db.execute(
            select(BpTransaction.id).where(
                BpTransaction.user_id == user.id,
                BpTransaction.reason == "seed",
            )
        )
    ).scalar_one_or_none()
    if seed_bp_exists is None:
        db.add(BpTransaction(user_id=user.id, amount=SEED_BP_AMOUNT, reason="seed"))

    seed_lp_exists = (
        await db.execute(
            select(LpEvent.id).where(
                LpEvent.user_id == user.id,
                LpEvent.source_type == "seed",
                LpEvent.source_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if seed_lp_exists is None:
        db.add(LpEvent(
            user_id=user.id,
            amount=SEED_LP_AMOUNT,
            source_type="seed",
            source_id=user.id,
            day_date=TODAY,
        ))


async def seed():
    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)

        # ── Create users ──────────────────────────────────────────────────────
        user_map: dict[str, User] = {}
        for u in SEED_USERS:
            existing = (await db.execute(
                select(User).where(User.email == u["email"])
            )).scalar_one_or_none()
            if existing:
                if not existing.password_hash:
                    existing.password_hash = hash_password(u["username"])
                    print(f"  restored password login: {u['username']}")
                await _ensure_seed_balances(db, existing)
                print(f"  skip user: {u['username']}")
                user_map[u["username"]] = existing
                continue

            user = User(
                id=uuid.uuid4(),
                email=u["email"],
                username=u["username"],
                password_hash=hash_password(u["username"]),  # password == username
                is_active=True,
            )
            db.add(user)
            await db.flush()
            await _ensure_seed_balances(db, user)
            user_map[u["username"]] = user
            print(f"  created user: {u['username']}")

        await db.flush()

        # ── Create friend relations ───────────────────────────────────────────
        for u1_name, u2_name in FRIEND_PAIRS:
            u1, u2 = user_map[u1_name], user_map[u2_name]
            existing = (await db.execute(
                select(FriendRequest).where(
                    FriendRequest.from_user_id == u1.id,
                    FriendRequest.to_user_id == u2.id,
                )
            )).scalar_one_or_none()
            if existing:
                print(f"  skip friends: {u1_name} <-> {u2_name}")
                continue
            db.add(FriendRequest(
                id=uuid.uuid4(),
                from_user_id=u1.id,
                to_user_id=u2.id,
                status="accepted",
            ))
            print(f"  friends: {u1_name} <-> {u2_name}")

        await db.flush()

        # ── Create chat messages ──────────────────────────────────────────────
        for (u1_name, u2_name), lines in CHAT_SCRIPTS.items():
            u1, u2 = user_map[u1_name], user_map[u2_name]
            # Check if any message already exists between this pair
            first_sender = lines[0][0]
            first_recipient = u2_name if first_sender == u1_name else u1_name
            existing = (await db.execute(
                select(Message.id).where(
                    Message.from_user_id == user_map[first_sender].id,
                    Message.to_user_id == user_map[first_recipient].id,
                ).limit(1)
            )).scalar_one_or_none()
            if existing:
                print(f"  skip messages: {u1_name} <-> {u2_name}")
                continue
            for i, (sender_name, content) in enumerate(lines):
                sender = user_map[sender_name]
                recipient_name = u2_name if sender_name == u1_name else u1_name
                recipient = user_map[recipient_name]
                db.add(Message(
                    id=uuid.uuid4(),
                    from_user_id=sender.id,
                    to_user_id=recipient.id,
                    content=content,
                    sent_at=now + timedelta(minutes=i),
                ))
            print(f"  messages: {u1_name} <-> {u2_name} ({len(lines)} msgs)")

        await db.flush()

        # ── Create markets ────────────────────────────────────────────────────
        market_map: dict[str, Bet] = {}
        for tmpl in MARKET_TEMPLATES:
            existing = (await db.execute(
                select(Bet).where(Bet.title == tmpl["title"])
            )).scalar_one_or_none()
            if existing:
                print(f"  skip market: {tmpl['title'][:55]}…")
                market_map[tmpl["title"]] = existing
                continue

            market = Bet(
                id=uuid.uuid4(),
                proposer_id=user_map[tmpl["proposer"]].id,
                title=tmpl["title"],
                description=tmpl["description"],
                resolution_criteria=tmpl["resolution_criteria"],
                deadline=now + random.choice(DEADLINE_OFFSETS),
                market_type=tmpl["market_type"],
                choices=tmpl.get("choices"),
                numeric_min=tmpl.get("numeric_min"),
                numeric_max=tmpl.get("numeric_max"),
                status="open",
                resolution_source=(
                    json.dumps(tmpl["resolution_source"])
                    if tmpl.get("resolution_source")
                    else None
                ),
            )
            db.add(market)
            market_map[tmpl["title"]] = market
            print(f"  created market [{tmpl['market_type']}]: {tmpl['title'][:55]}…")

        await db.flush()

        # ── Add activity to each market ───────────────────────────────────────
        all_users = list(user_map.values())

        for tmpl in MARKET_TEMPLATES:
            market = market_map[tmpl["title"]]
            proposer = user_map[tmpl["proposer"]]
            others = [u for u in all_users if u.id != proposer.id]

            # Market upvotes (2–4 from other users)
            for voter in random.sample(others, k=random.randint(2, 4)):
                exists = (await db.execute(
                    select(BetUpvote).where(
                        BetUpvote.bet_id == market.id,
                        BetUpvote.user_id == voter.id,
                    )
                )).scalar_one_or_none()
                if not exists:
                    db.add(BetUpvote(bet_id=market.id, user_id=voter.id))
                    db.add(LpEvent(
                        user_id=proposer.id, amount=1, source_type="market_upvote",
                        source_id=market.id, day_date=TODAY,
                    ))

            # Positions from other users (2–4 bets)
            for bettor in random.sample(others, k=random.randint(2, 4)):
                exists = (await db.execute(
                    select(BetPosition).where(
                        BetPosition.bet_id == market.id,
                        BetPosition.user_id == bettor.id,
                    )
                )).scalar_one_or_none()
                if exists:
                    continue
                if tmpl["market_type"] == "binary":
                    side = random.choice(["yes", "no"])
                elif tmpl["market_type"] == "multiple_choice":
                    side = random.choice(tmpl["choices"])
                else:
                    lo, hi = tmpl["numeric_min"], tmpl["numeric_max"]
                    side = str(round(random.uniform(lo, hi), 1))
                db.add(BetPosition(
                    id=uuid.uuid4(),
                    bet_id=market.id,
                    user_id=bettor.id,
                    side=side,
                    bp_staked=float(random.randint(1, 10)),
                ))

            # Comments (2–4 from other users) + upvotes on each comment
            for commenter in random.sample(others, k=random.randint(2, 4)):
                comment = Comment(
                    id=uuid.uuid4(),
                    bet_id=market.id,
                    user_id=commenter.id,
                    content=random.choice(COMMENT_POOL),
                )
                db.add(comment)
                await db.flush()

                upvoters = [u for u in all_users if u.id != commenter.id]
                for cup in random.sample(upvoters, k=random.randint(1, 2)):
                    exists = (await db.execute(
                        select(CommentUpvote).where(
                            CommentUpvote.comment_id == comment.id,
                            CommentUpvote.user_id == cup.id,
                        )
                    )).scalar_one_or_none()
                    if not exists:
                        db.add(CommentUpvote(comment_id=comment.id, user_id=cup.id))
                        db.add(LpEvent(
                            user_id=commenter.id, amount=1, source_type="comment_upvote",
                            source_id=comment.id, day_date=TODAY,
                        ))

        await db.commit()
    print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
