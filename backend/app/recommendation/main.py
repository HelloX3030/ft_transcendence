from fastapi import FastAPI

from .schemas import EngagementSignal, FeedRequest, HealthResponse, ScoredMovie

app = FastAPI(title="CineMatch Recommender", version="0.1.0")


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.post("/feed", response_model=list[ScoredMovie])
async def get_feed(request: FeedRequest) -> list[ScoredMovie]:
    # TODO: wire up RecommenderEngine
    return []


@app.post("/signal", status_code=204)
async def record_signal(payload: EngagementSignal) -> None:
    # TODO: wire up RecommenderEngine
    pass


@app.post("/retrain", status_code=202)
async def trigger_retrain(secret: str) -> dict:
    # TODO: verify secret, schedule SVD retrain job
    return {"status": "scheduled"}
