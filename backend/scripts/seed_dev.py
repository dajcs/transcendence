"""Dev seed script: creates test users alice and bob.

Run via: make seed
Or: docker compose exec backend uv run python scripts/seed_dev.py

Safe to run multiple times — skips existing users.
"""
import asyncio
import uuid

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.db.models.user import User
from app.utils.password import hash_password


SEED_USERS = [
    {
        "email": "alice@example.com",
        "username": "alice",
        "password": "Passw0rd!",
    },
    {
        "email": "bob@example.com",
        "username": "bob",
        "password": "Passw0rd!",
    },
]


async def seed():
    async with AsyncSessionLocal() as db:
        for u in SEED_USERS:
            result = await db.execute(select(User).where(User.email == u["email"]))
            if result.scalar_one_or_none():
                print(f"  skip: {u['email']} already exists")
                continue
            user = User(
                id=uuid.uuid4(),
                email=u["email"],
                username=u["username"],
                password_hash=hash_password(u["password"]),
                is_active=True,
            )
            db.add(user)
            print(f"  created: {u['email']} / {u['username']}")
        await db.commit()
    print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
