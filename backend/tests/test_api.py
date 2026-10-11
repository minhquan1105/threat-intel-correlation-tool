
import os

# Configure a test database before importing the application.
os.environ["DATABASE_URL"] = "sqlite://"

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app import models
from app.database import Base, get_db
from app.main import app
from app.services.normalization import normalize_indicator_value
from app.services.risk_scoring import calculate_indicator_risk
from app.services.batch_risk_scoring import (
    apply_batch_risk_scores,
    preview_batch_risk_scores,
)


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    Base.metadata.create_all(bind=engine)

    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
    )

    session = TestingSessionLocal()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


def test_indicator_create_and_duplicate_rejection(client):
    payload = {
        "value": "1.2.3.4",
        "indicator_type": "ip",
        "description": "Test IOC",
    }

    response = client.post("/indicators", json=payload)
    assert response.status_code == 200, response.text
    assert response.json()["value"] == "1.2.3.4"

    duplicate = client.post("/indicators", json=payload)
    assert duplicate.status_code == 409


def test_campaign_creation_and_relationship(client):
    indicator_response = client.post(
        "/indicators",
        json={
            "value": "example.com",
            "indicator_type": "domain",
            "description": "Domain IOC",
        },
    )
    assert indicator_response.status_code == 200
    indicator_id = indicator_response.json()["id"]

    campaign_response = client.post(
        "/campaigns",
        json={
            "name": "Test Campaign",
            "description": "Campaign correlation test",
        },
    )
    assert campaign_response.status_code == 200
    campaign_id = campaign_response.json()["id"]

    relationship_response = client.post(
        f"/campaigns/{campaign_id}/indicators/{indicator_id}"
    )
    assert relationship_response.status_code == 200
    assert relationship_response.json()["campaign_id"] == campaign_id
    assert relationship_response.json()["indicator_id"] == indicator_id


def test_normalization_and_risk_scoring():
    normalized = normalize_indicator_value(
        "https://EXAMPLE.com:443/path", "url"
    )
    assert normalized == "https://example.com:443/path"

    score = calculate_indicator_risk(
        source_count=3,
        campaign_count=2,
        recent_observations=4,
        days_since_first_seen=7,
        repeated_observation_count=5,
    )
    assert 0 <= score <= 100
    assert score > 0


def test_ingestion_parsing():
    from app.services.ingestion.urlhaus import parse_urlhaus_record

    record = {
        "url": "http://example.com/malware",
        "tags": ["phishing", "botnet"],
        "date_added": "2024-01-01 00:00:00",
        "threat": "test-campaign",
    }

    parsed = parse_urlhaus_record(record)

    assert parsed["indicator_type"] == "url"
    assert parsed["value"] == "http://example.com/malware"
    assert parsed["campaign_name"] == "test-campaign"


def test_batch_risk_scoring_dry_run_and_persistence(db_session):
    indicator = models.Indicator(
        value="http://example.com/suspicious",
        indicator_type="url",
    )
    source = models.Source(
        name="URLHaus",
        url="https://urlhaus.abuse.ch/",
    )
    campaign = models.Campaign(
        name="urlhaus-feed",
        description="Generic feed label",
    )

    db_session.add_all([indicator, source, campaign])
    db_session.flush()

    db_session.add(
        models.IndicatorSource(
            indicator_id=indicator.id,
            source_id=source.id,
        )
    )
    indicator.campaigns.append(campaign)
    db_session.commit()

    preview = preview_batch_risk_scores(
        db_session, batch_size=1
    )

    assert preview["mode"] == "dry_run"
    assert preview["processed"] == 1
    assert preview["database_modified"] is False
    assert db_session.query(models.RiskScore).count() == 0

    first_run = apply_batch_risk_scores(
        db_session, batch_size=1
    )

    assert first_run["processed"] == 1
    assert first_run["created"] == 1
    assert db_session.query(models.RiskScore).count() == 1

    saved_score = db_session.query(models.RiskScore).one()

    # Generic feed labels must not inflate campaign risk.
    assert saved_score.score == 10
    assert saved_score.severity == "low"

    second_run = apply_batch_risk_scores(
        db_session, batch_size=1
    )

    assert second_run["created"] == 0
    assert second_run["unchanged"] == 1
    assert db_session.query(models.RiskScore).count() == 1
