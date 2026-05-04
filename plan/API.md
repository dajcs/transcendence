# API Documentation

## API Basics

All backend routes are served under `/api` through Nginx.

| Environment | Base URL |
|---|---|
| Local Docker | `https://localhost:8443` |
| Production | `https://voxpo.me` |

FastAPI documentation is available at:

| Documentation | Local URL | Production URL |
|---|---|---|
| Swagger UI | [https://localhost:8443/api/docs](https://localhost:8443/api/docs) | [https://voxpo.me/api/docs](https://voxpo.me/api/docs) |
| ReDoc | [https://localhost:8443/api/redoc](https://localhost:8443/api/redoc) | [https://voxpo.me/api/redoc](https://voxpo.me/api/redoc) |
| OpenAPI JSON | [https://localhost:8443/api/openapi.json](https://localhost:8443/api/openapi.json) | [https://voxpo.me/api/openapi.json](https://voxpo.me/api/openapi.json) |


### Useful checks:

```bash
# local uses a self-signed certificate
curl -k https://localhost:8443/api/health
curl -k https://localhost:8443/api/public/markets
curl -k https://localhost:8443/api/docs

# production should verify without -k
curl https://voxpo.me/api/health
curl https://voxpo.me/api/public/markets
curl https://voxpo.me/api/docs
```

### Public API

The read-only public API is anonymous and rate-limited to **60 requests per 60 seconds per client IP**. If Redis is unavailable, the limiter logs a warning and allows the request.

Current public endpoints:

- `GET /api/public/markets`
- `GET /api/public/markets/{market_id}`
- `GET /api/public/markets/{market_id}/comments`
- `GET /api/public/markets/{market_id}/positions`
- `GET /api/public/markets/{market_id}/payouts`
- `GET /api/public/users/{username}`
- `GET /api/public/leaderboards`

Example:

```bash
curl https://voxpo.me/api/public/markets
```

Rate-limit check:

```bash
for i in $(seq 1 65); do
  curl -s -o /dev/null -w "$i %{http_code}\n" https://voxpo.me/api/public/markets
done
```

After the limit is exceeded, the API returns `429` with a `Retry-After` header.

### Authenticated API

Protected endpoints use secure HTTP-only cookies set by `/api/auth/login`. Browser requests include these automatically after login. For curl, store and reuse cookies:

```bash
curl -k -c cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test-password"}' \
  https://localhost:8443/api/auth/login

curl -k -b cookies.txt https://localhost:8443/api/friends
```

Without a valid auth cookie, protected endpoints return:

```json
{"detail":"Not authenticated"}
```
