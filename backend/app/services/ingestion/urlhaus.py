import re
from datetime import datetime, timezone

import requests
from sqlalchemy.orm import Session

from app import models
from app.services.normalization import normalize_indicator_value


def parse_urlhaus_record(record: dict | str) -> dict:
    if isinstance(record, str):
        candidate = record.strip()
        if not candidate or candidate.startswith("#"):
            raise ValueError("Blank or comment record")

        values = [segment.strip() for segment in re.split(r"\s*\|\|\s*|\s*,\s*", candidate)]
        data = {"url": values[0], "threat": values[1] if len(values) > 1 else "unknown"}
        if "http" not in data["url"]:
            raise ValueError("Record does not contain URL")
        return {
            "value": data["url"],
            "indicator_type": "url",
            "description": f"URLHaus entry for {data['threat']}",
            "campaign_name": data["threat"],
            "source_name": "URLHaus",
            "external_reference": data["url"],
            "first_seen": datetime.now(timezone.utc),
            "last_seen": datetime.now(timezone.utc),
        }

    if not isinstance(record, dict):
        raise ValueError("URLHaus record must be a dictionary or string")

    url_value = record.get("url") or record.get("uri") or record.get("value")
    if not url_value:
        raise ValueError("Record missing URL value")

    ts_value = record.get("date_added") or record.get("first_seen")
    date_value = None
    if ts_value:
        try:
            date_value = datetime.strptime(ts_value, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            date_value = datetime.now(timezone.utc)

    campaign_name = record.get("threat") or record.get("campaign") or record.get("tag") or "unknown"

    return {
        "value": url_value,
        "indicator_type": "url",
        "description": record.get("description") or f"URLHaus feed entry for {campaign_name}",
        "campaign_name": campaign_name,
        "source_name": "URLHaus",
        "external_reference": record.get("reference") or url_value,
        "first_seen": date_value or datetime.now(timezone.utc),
        "last_seen": date_value or datetime.now(timezone.utc),
    }


def fetch_urlhaus_records() -> list[dict]:
    urls = [
        "https://urlhaus.abuse.ch/downloads/text_online/",
        "https://urlhaus.abuse.ch/downloads/text/",
    ]

    for feed_url in urls:
        try:
            response = requests.get(feed_url, timeout=20)
            if response.status_code != 200:
                continue
            raw_text = response.text.strip()
            if not raw_text:
                continue

            records = []
            for line in raw_text.splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                records.append({"url": line.split()[0], "threat": "urlhaus-feed"})
            return records
        except requests.RequestException:
            continue

    return []


def ingest_urlhaus(db: Session) -> dict:
    stats = {
        "records_processed": 0,
        "indicators_created": 0,
        "indicators_updated": 0,
        "duplicates": 0,
        "failures": 0,
    }

    source = db.query(models.Source).filter(models.Source.name == "URLHaus").first()
    if not source:
        source = models.Source(name="URLHaus", url="https://urlhaus.abuse.ch/")
        db.add(source)
        db.commit()
        db.refresh(source)

    records = fetch_urlhaus_records()
    if not records:
        return stats

    for record in records:
        stats["records_processed"] += 1
        try:
            parsed = parse_urlhaus_record(record)
        except ValueError:
            stats["failures"] += 1
            continue

        normalized_value = normalize_indicator_value(parsed["value"], parsed["indicator_type"])
        indicator = db.query(models.Indicator).filter(models.Indicator.value == normalized_value).first()

        if indicator is None:
            indicator = models.Indicator(
                value=normalized_value,
                indicator_type=parsed["indicator_type"],
                description=parsed["description"],
                first_seen=parsed["first_seen"],
                last_seen=parsed["last_seen"],
            )
            db.add(indicator)
            db.flush()
            stats["indicators_created"] += 1
        else:
            stats["duplicates"] += 1
            indicator.last_seen = max((indicator.last_seen or parsed["last_seen"]), parsed["last_seen"])
            indicator.first_seen = min((indicator.first_seen or parsed["first_seen"]), parsed["first_seen"])
            stats["indicators_updated"] += 1

        if indicator.id is not None:
            existing_link = (
                db.query(models.IndicatorSource)
                .filter(models.IndicatorSource.indicator_id == indicator.id)
                .filter(models.IndicatorSource.source_id == source.id)
                .first()
            )
            if not existing_link:
                link = models.IndicatorSource(
                    indicator_id=indicator.id,
                    source_id=source.id,
                    external_reference=parsed["external_reference"],
                    first_seen=parsed["first_seen"],
                    last_seen=parsed["last_seen"],
                )
                db.add(link)
            else:
                existing_link.external_reference = parsed["external_reference"]
                existing_link.first_seen = min((existing_link.first_seen or parsed["first_seen"]), parsed["first_seen"])
                existing_link.last_seen = max((existing_link.last_seen or parsed["last_seen"]), parsed["last_seen"])

        if parsed.get("campaign_name"):
            campaign = db.query(models.Campaign).filter(models.Campaign.name == parsed["campaign_name"]).first()
            if campaign is None:
                campaign = models.Campaign(name=parsed["campaign_name"], description=f"Imported from URLHaus: {parsed['campaign_name']}")
                db.add(campaign)
                db.flush()
            if indicator not in campaign.indicators:
                campaign.indicators.append(indicator)

    db.commit()
    return stats
