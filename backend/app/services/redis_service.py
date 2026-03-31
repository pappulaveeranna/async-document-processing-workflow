import json
import redis
from app.core.config import settings

_client = redis.from_url(settings.REDIS_URL, decode_responses=True)


def get_redis():
    return _client


def publish_progress(job_id: str, event: str, progress: int, stage: str, message: str = ""):
    payload = json.dumps({
        "job_id": job_id,
        "event": event,
        "progress": progress,
        "stage": stage,
        "message": message,
    })
    _client.publish(f"job:{job_id}", payload)
    _client.setex(f"job_status:{job_id}", 3600, payload)


def get_cached_status(job_id: str):
    data = _client.get(f"job_status:{job_id}")
    return json.loads(data) if data else None


def subscribe_to_job(job_id: str):
    pubsub = _client.pubsub()
    pubsub.subscribe(f"job:{job_id}")
    return pubsub
