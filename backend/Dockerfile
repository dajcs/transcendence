FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install --no-cache-dir uv

# Copy dependency files first (layer caching)
COPY pyproject.toml uv.lock* ./

# Install Python dependencies
RUN uv sync --frozen --no-dev

# Copy application code
COPY . .

# Create non-root user for Celery workers
RUN adduser --disabled-password --gecos '' celeryuser \
    && chown -R celeryuser:celeryuser /app

# Expose port
EXPOSE 8000

# Default command (overridden by docker-compose entrypoint for migration + start)
CMD ["uv", "run", "uvicorn", "app.main:socket_app", "--host", "0.0.0.0", "--port", "8000"]
