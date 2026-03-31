import os
import redis as redis_lib
from pydantic_settings import BaseSettings


def _check_redis(url: str):
    try:
        r = redis_lib.from_url(url, socket_connect_timeout=2)
        r.ping()
    except Exception as e:
        raise RuntimeError(
            f"Redis is required but not reachable at {url}. "
            f"Start Redis first: docker run -p 6379:6379 redis:7-alpine\nError: {e}"
        )


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://docuser:docpass@localhost:5432/docprocessing"
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"
    UPLOAD_DIR: str = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads"
    )
    MAX_FILE_SIZE_MB: int = 50

    class Config:
        env_file = ".env"


settings = Settings()

# Fail fast — Redis must be running
_check_redis(settings.REDIS_URL)
