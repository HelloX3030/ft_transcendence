"""The /retrain auth gate. Exercised through the real app, since the point of
these is that no request slips past the secret check."""

import pytest
from fastapi.testclient import TestClient

from recommendation import main
from recommendation.retrain import RetrainResult

SECRET = "s3cret-value"


class _StubRetrainer:
    def __init__(self, running: bool = False) -> None:
        self.running = running
        self.last_result: RetrainResult | None = None
        self.runs = 0

    async def run(self) -> RetrainResult:
        self.runs += 1
        return RetrainResult("trained", 40, 5, 5, 0.1)


@pytest.fixture
def client(monkeypatch):
    """The app without its lifespan: startup would reach for a DB and TMDB."""
    monkeypatch.setenv("RETRAIN_SECRET", SECRET)
    monkeypatch.setattr(main, "_retrainer", _StubRetrainer(), raising=False)
    return TestClient(main.app)


def _post(client, secret: str | None = SECRET):
    headers = {"X-Retrain-Secret": secret} if secret is not None else {}
    return client.post("/retrain", headers=headers)


def test_the_right_secret_schedules_a_retrain(client):
    response = _post(client)

    assert response.status_code == 202
    assert response.json()["status"] == "scheduled"
    assert main._retrainer.runs == 1  # the background task actually ran


def test_a_wrong_secret_is_rejected(client):
    response = _post(client, "wrong")

    assert response.status_code == 401
    assert main._retrainer.runs == 0


def test_a_missing_secret_is_rejected(client):
    response = _post(client, None)

    assert response.status_code == 401
    assert main._retrainer.runs == 0


def test_an_empty_secret_is_rejected(client):
    assert _post(client, "").status_code == 401


def test_a_secret_that_is_a_prefix_of_the_real_one_is_rejected(client):
    assert _post(client, SECRET[:-1]).status_code == 401


def test_an_unconfigured_secret_refuses_rather_than_running(monkeypatch):
    # The dangerous default would be to treat "no secret set" as "no auth needed".
    monkeypatch.delenv("RETRAIN_SECRET", raising=False)
    monkeypatch.setattr(main, "_retrainer", _StubRetrainer(), raising=False)

    response = TestClient(main.app).post("/retrain", headers={"X-Retrain-Secret": "anything"})

    assert response.status_code == 503
    assert main._retrainer.runs == 0


def test_the_secret_is_checked_before_the_database_is_considered(monkeypatch):
    # Without a DB there is no retrainer; an unauthenticated caller must still
    # get 401, not a 503 that confirms the deployment's shape.
    monkeypatch.setenv("RETRAIN_SECRET", SECRET)
    monkeypatch.setattr(main, "_retrainer", None, raising=False)

    assert TestClient(main.app).post(
        "/retrain", headers={"X-Retrain-Secret": "wrong"}
    ).status_code == 401


def test_without_a_database_an_authenticated_caller_is_told_why(monkeypatch):
    monkeypatch.setenv("RETRAIN_SECRET", SECRET)
    monkeypatch.setattr(main, "_retrainer", None, raising=False)

    response = TestClient(main.app).post("/retrain", headers={"X-Retrain-Secret": SECRET})

    assert response.status_code == 503
    assert "DATABASE_URL" in response.json()["detail"]


def test_a_retrain_already_in_flight_is_not_started_twice(client, monkeypatch):
    monkeypatch.setattr(main, "_retrainer", _StubRetrainer(running=True), raising=False)

    response = _post(client)

    assert response.status_code == 202
    assert response.json()["status"] == "already_running"
    assert main._retrainer.runs == 0


def test_the_response_carries_the_previous_run(client):
    main._retrainer.last_result = RetrainResult("trained", 40, 5, 5, 0.1)

    body = _post(client).json()

    assert body["previous"]["status"] == "trained"
    assert body["previous"]["interactions"] == 40
