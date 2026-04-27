---
phase: quick-260427-jbh-encrypt-user-supplied-llm-api-keys-at-th
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/services/secret_service.py
  - backend/app/db/models/user.py
  - backend/app/api/routes/users.py
  - backend/app/api/routes/llm.py
  - backend/tests/test_users.py
autonomous: true
requirements:
  - QUICK-260427-JBH
must_haves:
  truths:
    - "User-supplied LLM API keys are encrypted by application code before database persistence."
    - "GET /api/users/me continues to expose only llm_api_key_set, never the secret value."
    - "Custom LLM summary and resolution flows pass decrypted key material to provider clients."
    - "Empty llm_api_key input still clears the saved secret."
  artifacts:
    - path: "backend/app/services/secret_service.py"
      provides: "Reusable encrypt/decrypt helpers for user-owned application secrets"
    - path: "backend/app/api/routes/users.py"
      provides: "Encrypted write path for PATCH /api/users/me"
    - path: "backend/app/api/routes/llm.py"
      provides: "Decrypted read path for custom LLM calls"
    - path: "backend/tests/test_users.py"
      provides: "Regression coverage for ciphertext at rest and decrypted provider use"
  key_links:
    - from: "backend/app/api/routes/users.py"
      to: "backend/app/services/secret_service.py"
      via: "encrypt_secret before assigning user.llm_api_key"
      pattern: "encrypt_secret\\("
    - from: "backend/app/api/routes/llm.py"
      to: "backend/app/services/secret_service.py"
      via: "decrypt_secret before call_custom_provider"
      pattern: "decrypt_secret\\("
    - from: "backend/tests/test_users.py"
      to: "backend/app/db/models/user.py"
      via: "direct DB assertion that stored llm_api_key is not plaintext"
      pattern: "assert user\\.llm_api_key !="
---

<objective>
Encrypt user-supplied LLM API keys at the application layer before writing to the database while preserving the existing `users.llm_api_key` column for compatibility.

Purpose: The settings API currently hides the key from responses but stores it as plaintext. This plan makes the existing column hold ciphertext and decrypts only at the custom-provider call boundary.

Output: One quick implementation with regression tests; do not commit anything.
</objective>

<execution_context>
@/home/anemet/transcendence/.codex/get-shit-done/workflows/execute-plan.md
@/home/anemet/transcendence/.codex/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@AGENTS.md
@backend/app/db/models/user.py
@backend/app/api/routes/users.py
@backend/app/api/routes/llm.py
@backend/app/services/oauth_service.py
@backend/app/services/llm_service.py
@backend/tests/test_users.py

<interfaces>
Existing contracts to preserve:

From `backend/app/db/models/user.py`:
```python
class User(Base):
    llm_mode: Mapped[str] = mapped_column(Text, nullable=False, default="default", server_default=sa.text("'default'"))
    llm_provider: Mapped[str | None] = mapped_column(Text, nullable=True)
    llm_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    llm_model: Mapped[str | None] = mapped_column(Text, nullable=True)
```

From `backend/app/api/routes/users.py`:
```python
class UpdateUserRequest(BaseModel):
    llm_mode: str | None = None
    llm_provider: str | None = None
    llm_api_key: str | None = None
    llm_model: str | None = None
```

From `backend/app/services/llm_service.py`:
```python
async def call_custom_provider(
    messages: list[dict[str, Any]],
    provider: str,
    api_key: str,
    model_override: str | None = None,
) -> str:
```
</interfaces>

Important constraints:
- Keep the existing `users.llm_api_key` DB column unless implementation proves a rename is unavoidable. The intended compatibility path is to change the column semantics from plaintext to ciphertext and update the model comment.
- Existing OAuth token column naming is `access_token_enc` / `refresh_token_enc`; do not rename the LLM column in this quick task.
- Do not add a new external dependency. `cryptography` is already available through `PyJWT[crypto]` and imported in tests.
- Do not commit changes; user requested review first.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add reusable application-secret encryption helpers</name>
  <files>backend/app/services/secret_service.py, backend/app/db/models/user.py</files>
  <behavior>
    - `encrypt_secret("secret-key")` returns a non-empty string that is not equal to `"secret-key"`.
    - `decrypt_secret(encrypt_secret("secret-key"))` returns `"secret-key"`.
    - `encrypt_secret(None)` and `decrypt_secret(None)` return `None`.
  </behavior>
  <action>Create `backend/app/services/secret_service.py` with `encrypt_secret(value: str | None) -> str | None` and `decrypt_secret(value: str | None) -> str | None`. Use Fernet from `cryptography.fernet`; derive the Fernet key from `settings.secret_key` with SHA-256 and URL-safe base64 so no new environment variable or migration is required. Preserve failure visibility: decryption failures should raise a clear application exception, not silently return garbage. Update the `User.llm_api_key` model comment to state that the existing column stores encrypted ciphertext for user-owned keys.</action>
  <verify>
    <automated>DATABASE_URL=sqlite+aiosqlite:///:memory: SECRET_KEY=test-secret JWT_PRIVATE_KEY_PATH=/tmp/missing JWT_PUBLIC_KEY_PATH=/tmp/missing uv run pytest backend/tests/test_users.py::test_patch_my_settings_encrypts_saved_api_key -q</automated>
  </verify>
  <done>Encryption helpers exist, round-trip correctly, and the model no longer documents plaintext storage.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Encrypt settings writes and preserve settings responses</name>
  <files>backend/app/api/routes/users.py, backend/tests/test_users.py</files>
  <behavior>
    - PATCH `/api/users/me` with `llm_api_key: "secret-key"` stores ciphertext in `User.llm_api_key`.
    - PATCH and GET responses still return `llm_api_key_set: true` without returning the key.
    - PATCH `/api/users/me` with `llm_api_key: ""` clears `User.llm_api_key` to `None` and returns `llm_api_key_set: false`.
  </behavior>
  <action>Import `encrypt_secret` in `backend/app/api/routes/users.py`. In `patch_my_settings`, replace direct assignment of `data.llm_api_key` with `encrypt_secret(data.llm_api_key)`, while preserving the existing empty-string-clears behavior. Keep `llm_api_key_set` based on whether ciphertext exists. Extend `backend/tests/test_users.py` by replacing or augmenting the existing settings round-trip test with a direct `db_session` lookup that asserts the stored value is not plaintext, is non-null, and still makes GET `/api/users/me` report only `llm_api_key_set`.</action>
  <verify>
    <automated>DATABASE_URL=sqlite+aiosqlite:///:memory: SECRET_KEY=test-secret JWT_PRIVATE_KEY_PATH=/tmp/missing JWT_PUBLIC_KEY_PATH=/tmp/missing uv run pytest backend/tests/test_users.py::test_patch_my_settings_encrypts_saved_api_key backend/tests/test_users.py::test_patch_my_settings_empty_api_key_clears_saved_secret -q</automated>
  </verify>
  <done>The settings write path never persists plaintext user LLM keys, and the public API contract remains unchanged.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Decrypt only at custom LLM provider boundaries</name>
  <files>backend/app/api/routes/llm.py, backend/tests/test_users.py</files>
  <behavior>
    - Custom LLM summary calls receive the original plaintext key in `call_custom_provider`.
    - The database continues to contain ciphertext before, during, and after the LLM route call.
    - Disabled/default LLM modes do not attempt decryption of a missing key.
  </behavior>
  <action>Import `decrypt_secret` in `backend/app/api/routes/llm.py`. In both custom-provider branches (`create_summary` and `create_resolution_hint`), decrypt `current_user.llm_api_key` immediately before calling `call_custom_provider`, pass the decrypted value, and do not write the decrypted value back to the SQLAlchemy model. Add a regression test in `backend/tests/test_users.py` that logs in, saves a custom key, creates the minimum market/comment data needed for `/api/bets/{bet_id}/summary`, monkeypatches `app.api.routes.llm._get_redis`, `_check_budget`, and `call_custom_provider`, invokes the route, and asserts the patched provider received `"secret-key"` while the stored `User.llm_api_key` still differs from `"secret-key"`.</action>
  <verify>
    <automated>DATABASE_URL=sqlite+aiosqlite:///:memory: SECRET_KEY=test-secret JWT_PRIVATE_KEY_PATH=/tmp/missing JWT_PUBLIC_KEY_PATH=/tmp/missing uv run pytest backend/tests/test_users.py::test_custom_llm_summary_receives_decrypted_saved_api_key -q</automated>
  </verify>
  <done>Custom LLM calls continue to work with user keys, but decrypted material exists only as a local value at the provider-call boundary.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser to PATCH /api/users/me | User-supplied secret crosses from client input into backend persistence |
| database to LLM provider call | Stored ciphertext is read by backend and converted to provider credential material |
| backend to third-party LLM API | Decrypted user key leaves the app only in provider Authorization/API-key context |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick-jbh-01 | I | `users.llm_api_key` | mitigate | Encrypt with Fernet before assigning the SQLAlchemy column; regression test asserts ciphertext differs from submitted key. |
| T-quick-jbh-02 | I | `GET /api/users/me` | mitigate | Preserve existing response contract that returns only `llm_api_key_set`; no route may return decrypted or encrypted key value. |
| T-quick-jbh-03 | I | `create_summary` / `create_resolution_hint` | mitigate | Decrypt into a local variable immediately before `call_custom_provider`; never assign plaintext back to the model. |
| T-quick-jbh-04 | D | secret decryption | accept | If `settings.secret_key` changes, existing ciphertext cannot decrypt; current project already treats `SECRET_KEY` as a stable deployment secret for auth. |
</threat_model>

<verification>
Run the targeted regression suite:

```bash
DATABASE_URL=sqlite+aiosqlite:///:memory: SECRET_KEY=test-secret JWT_PRIVATE_KEY_PATH=/tmp/missing JWT_PUBLIC_KEY_PATH=/tmp/missing uv run pytest backend/tests/test_users.py::test_patch_my_settings_encrypts_saved_api_key backend/tests/test_users.py::test_patch_my_settings_empty_api_key_clears_saved_secret backend/tests/test_users.py::test_custom_llm_summary_receives_decrypted_saved_api_key -q
```

Then run the full user route test file:

```bash
DATABASE_URL=sqlite+aiosqlite:///:memory: SECRET_KEY=test-secret JWT_PRIVATE_KEY_PATH=/tmp/missing JWT_PUBLIC_KEY_PATH=/tmp/missing uv run pytest backend/tests/test_users.py -q
```
</verification>

<success_criteria>
- `User.llm_api_key` no longer stores plaintext for newly saved user LLM keys.
- Settings API responses remain backward compatible and never expose the key value.
- Custom LLM route code decrypts encrypted key material and passes the original secret to `call_custom_provider`.
- Empty key input clears the stored ciphertext.
- Targeted tests pass.
- No git commit is created.
</success_criteria>

<output>
After completion, create `.planning/quick/260427-jbh-encrypt-user-supplied-llm-api-keys-at-th/260427-jbh-SUMMARY.md`.
</output>
