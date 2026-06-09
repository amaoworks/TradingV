"""Tests for the web backend API."""
import asyncio
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from web.backend.main import app
from web.backend import database as db


@pytest.fixture(autouse=True)
def setup_db(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "_DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.delenv("TRADINGV_DEBUG_AUTH", raising=False)
    db.init_db()


@pytest.fixture(autouse=True)
def mock_graph_runner():
    """Mock GraphRunner.run so it completes instantly without calling the real graph."""
    async def fake_run(self):
        db.update_analysis_status(self.analysis_id, "complete", signal="BUY", confidence=75.0)
        await self.queue.put({
            "type": "analysis_complete", "agent": "system",
            "content": "BUY", "stats": {"tokens": 0}, "timestamp": "2025-01-01T00:00:00Z",
        })

    with patch("web.backend.graph_runner.GraphRunner.run", fake_run):
        yield


@pytest.fixture
def client():
    return TestClient(app)


class TestHealth:
    def test_health(self, client):
        r = client.get("/api/health")
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}


class TestAuthAndUsers:
    def _debug_admin_headers(self, client, monkeypatch):
        monkeypatch.setenv("TRADINGV_DEBUG_AUTH", "1")
        r = client.post("/api/auth/login", json={"username": "admin", "password": "admin"})
        assert r.status_code == 200
        return {"Authorization": f"Bearer {r.json()['access_token']}"}

    def test_login_without_user_rejects_by_default(self, client):
        r = client.post("/api/auth/login", json={"username": "admin", "password": "admin"})
        assert r.status_code == 401

    def test_register_first_user_as_admin_and_login(self, client):
        r = client.post("/api/auth/register", json={
            "username": "owner",
            "email": "owner@example.com",
            "password": "secret",
        })
        assert r.status_code == 201
        assert r.json()["user"]["role"] == "admin"

        r = client.post("/api/auth/login", json={"username": "owner", "password": "secret"})
        assert r.status_code == 200
        token = r.json()["access_token"]

        r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert r.json()["username"] == "owner"

    def test_debug_auth_login_creates_admin(self, client, monkeypatch):
        monkeypatch.setenv("TRADINGV_DEBUG_AUTH", "1")
        r = client.post("/api/auth/login", json={"username": "admin", "password": "admin"})
        assert r.status_code == 200
        data = r.json()
        assert data["access_token"].count(".") == 2
        assert data["user"]["username"] == "admin"
        assert data["user"]["role"] == "admin"

    def test_debug_auth_rejects_wrong_password(self, client, monkeypatch):
        monkeypatch.setenv("TRADINGV_DEBUG_AUTH", "1")
        r = client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
        assert r.status_code == 401

    def test_user_crud_requires_admin(self, client, monkeypatch):
        r = client.get("/api/users")
        assert r.status_code == 401

        headers = self._debug_admin_headers(client, monkeypatch)

        r = client.post("/api/users", headers=headers, json={
            "username": "viewer1",
            "email": "viewer1@example.com",
            "password": "secret",
            "role": "viewer",
        })
        assert r.status_code == 201
        user = r.json()
        assert user["role"] == "viewer"
        assert user["active"] is True

        r = client.get("/api/users", headers=headers)
        assert r.status_code == 200
        assert {u["username"] for u in r.json()["items"]} == {"admin", "viewer1"}

        r = client.put(f"/api/users/{user['id']}", headers=headers, json={"active": False})
        assert r.status_code == 200
        assert r.json()["active"] is False

        r = client.delete(f"/api/users/{user['id']}", headers=headers)
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_chat_requires_auth(self, client):
        r = client.get("/api/chat/rooms")
        assert r.status_code == 401

    def test_chat_rooms_and_messages(self, client, monkeypatch):
        headers = self._debug_admin_headers(client, monkeypatch)

        r = client.get("/api/chat/rooms", headers=headers)
        assert r.status_code == 200
        rooms = r.json()["items"]
        assert {room["key"] for room in rooms} >= {"general", "trading", "strategy", "news"}
        assert rooms[0]["messages"]

        r = client.post(
            "/api/chat/rooms/general/messages",
            headers=headers,
            json={"text": "hello from pytest"},
        )
        assert r.status_code == 201
        assert r.json()["user"] == "admin"
        assert r.json()["text"] == "hello from pytest"

        r = client.get("/api/chat/rooms/general/messages", headers=headers)
        assert r.status_code == 200
        assert any(message["text"] == "hello from pytest" for message in r.json()["items"])


class TestSettings:
    def test_get_settings(self, client):
        r = client.get("/api/settings")
        assert r.status_code == 200
        data = r.json()
        assert "llm_provider" in data
        assert "deep_think_llm" in data

    def test_update_settings(self, client):
        r = client.put("/api/settings", json={"max_debate_rounds": 3})
        assert r.status_code == 200
        assert r.json()["ok"] is True

        r = client.get("/api/settings")
        assert r.json()["max_debate_rounds"] == 3


class TestAnalyze:
    def test_start_analysis(self, client):
        r = client.post("/api/analyze", json={
            "ticker": "AAPL",
            "trade_date": "2025-01-15",
        })
        assert r.status_code == 200
        data = r.json()
        assert "id" in data
        assert data["status"] == "pending"

    def test_get_status_not_found(self, client):
        r = client.get("/api/analyze/nonexistent/status")
        assert r.status_code == 404

    def test_get_status(self, client):
        r = client.post("/api/analyze", json={
            "ticker": "NVDA",
            "trade_date": "2025-01-15",
        })
        aid = r.json()["id"]

        r = client.get(f"/api/analyze/{aid}/status")
        assert r.status_code == 200
        assert r.json()["status"] in ("pending", "running", "complete")


class TestHistory:
    def test_empty_history(self, client):
        r = client.get("/api/history")
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 0
        assert data["items"] == []

    def test_history_with_data(self, client):
        client.post("/api/analyze", json={"ticker": "TSLA", "trade_date": "2025-01-10"})
        client.post("/api/analyze", json={"ticker": "AAPL", "trade_date": "2025-01-11"})

        r = client.get("/api/history")
        assert r.json()["total"] == 2

    def test_history_filter_ticker(self, client):
        client.post("/api/analyze", json={"ticker": "TSLA", "trade_date": "2025-01-10"})
        client.post("/api/analyze", json={"ticker": "AAPL", "trade_date": "2025-01-11"})

        r = client.get("/api/history", params={"ticker": "TSLA"})
        assert r.json()["total"] == 1
        assert r.json()["items"][0]["ticker"] == "TSLA"


class TestReports:
    def test_report_not_found(self, client):
        r = client.get("/api/reports/nonexistent")
        assert r.status_code == 404

    def test_report_detail(self, client):
        r = client.post("/api/analyze", json={"ticker": "GOOG", "trade_date": "2025-01-12"})
        aid = r.json()["id"]

        r = client.get(f"/api/reports/{aid}")
        assert r.status_code == 200
        assert r.json()["analysis"]["ticker"] == "GOOG"

    def test_delete_report(self, client):
        r = client.post("/api/analyze", json={"ticker": "META", "trade_date": "2025-01-13"})
        aid = r.json()["id"]

        r = client.delete(f"/api/reports/{aid}")
        assert r.status_code == 200

        r = client.get(f"/api/reports/{aid}")
        assert r.status_code == 404

    def test_export_md(self, client):
        r = client.post("/api/analyze", json={"ticker": "AMZN", "trade_date": "2025-01-14"})
        aid = r.json()["id"]

        r = client.get(f"/api/reports/{aid}/export", params={"format": "md"})
        assert r.status_code == 200
        assert "AMZN" in r.json()["content"]


class TestDashboard:
    def test_dashboard_empty(self, client):
        r = client.get("/api/dashboard")
        assert r.status_code == 200
        assert r.json()["recent"] == []

    def test_dashboard_with_data(self, client):
        client.post("/api/analyze", json={"ticker": "AAPL", "trade_date": "2025-01-15"})
        r = client.get("/api/dashboard")
        assert len(r.json()["recent"]) == 1


class TestWebSocket:
    def test_ws_completed_analysis(self, client):
        """WS on a completed analysis with no stored events should close cleanly."""
        # Create an analysis that completes via mock
        r = client.post("/api/analyze", json={"ticker": "WS", "trade_date": "2025-01-01"})
        aid = r.json()["id"]

        import time
        time.sleep(0.5)  # let background task complete

        with client.websocket_connect(f"/ws/analyze/{aid}") as ws:
            # Should receive stored events (the analysis_complete from mock)
            data = ws.receive_json()
            assert data["type"] == "analysis_complete"
