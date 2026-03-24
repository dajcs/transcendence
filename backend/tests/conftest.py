"""Shared pytest fixtures."""
import tempfile
from pathlib import Path

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fakeredis.aioredis import FakeRedis
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app


@pytest.fixture(scope="session")
def rsa_key_pair(tmp_path_factory):
    """Generate a temporary RSA key pair for JWT tests."""
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    tmp_dir = tmp_path_factory.mktemp("keys")
    priv_path = tmp_dir / "jwt_private.pem"
    pub_path = tmp_dir / "jwt_public.pem"
    priv_path.write_bytes(
        private_key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.TraditionalOpenSSL,
            serialization.NoEncryption(),
        )
    )
    pub_path.write_bytes(
        private_key.public_key().public_bytes(
            serialization.Encoding.PEM,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        )
    )
    return str(priv_path), str(pub_path)


@pytest.fixture(autouse=True)
def patch_jwt_key_paths(rsa_key_pair, monkeypatch):
    """Point settings to temp RSA keys so JWT utils work without Docker secrets."""
    from app.config import settings
    priv_path, pub_path = rsa_key_pair
    monkeypatch.setattr(settings, "jwt_private_key_path", priv_path)
    monkeypatch.setattr(settings, "jwt_public_key_path", pub_path)


@pytest.fixture
async def db_engine():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
async def db_session(db_engine):
    session_factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session


@pytest.fixture
async def client(db_session: AsyncSession):
    import app.services.auth_service as auth_svc

    async def override_get_db():
        yield db_session

    # Patch Redis with fakeredis so tests don't need a live Redis server
    fake_redis = FakeRedis(decode_responses=True)
    auth_svc._redis = fake_redis

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
    auth_svc._redis = None
