
from sqlalchemy.orm import Session, selectinload

from app import models


def build_graph_data(db: Session, limit: int = 100) -> dict:
    nodes = []
    edges = []
    seen_nodes = set()

    indicators = (
        db.query(models.Indicator)
        .options(
            selectinload(models.Indicator.campaigns),
            selectinload(models.Indicator.sources)
            .selectinload(models.IndicatorSource.source),
        )
        .order_by(models.Indicator.id.desc())
        .limit(limit)
        .all()
    )

    for indicator in indicators:
        node_id = f"indicator-{indicator.id}"

        if node_id not in seen_nodes:
            nodes.append({
                "id": node_id,
                "label": indicator.value[:80],
                "type": "indicator"
            })
            seen_nodes.add(node_id)

        for campaign in indicator.campaigns:
            campaign_id = f"campaign-{campaign.id}"

            if campaign_id not in seen_nodes:
                nodes.append({
                    "id": campaign_id,
                    "label": campaign.name[:80],
                    "type": "campaign"
                })
                seen_nodes.add(campaign_id)

            edges.append({
                "source": node_id,
                "target": campaign_id,
                "relationship": "associated_with"
            })

        for source_link in indicator.sources:
            source = source_link.source
            source_id = f"source-{source.id}"

            if source_id not in seen_nodes:
                nodes.append({
                    "id": source_id,
                    "label": source.name[:80],
                    "type": "source"
                })
                seen_nodes.add(source_id)

            edges.append({
                "source": node_id,
                "target": source_id,
                "relationship": "observed_by"
            })

    unique_edges = []
    edge_keys = set()

    for edge in edges:
        key = (
            edge["source"],
            edge["target"],
            edge["relationship"]
        )

        if key not in edge_keys:
            unique_edges.append(edge)
            edge_keys.add(key)

    return {
        "nodes": nodes,
        "edges": unique_edges
    }


def build_indicator_correlations(
    db: Session,
    indicator_id: int
) -> dict:
    indicator = (
        db.query(models.Indicator)
        .filter(models.Indicator.id == indicator_id)
        .first()
    )

    if not indicator:
        raise ValueError("Indicator not found")

    shared_campaigns = [
        campaign.name
        for campaign in indicator.campaigns
    ]

    shared_sources = [
        source_link.source.name
        for source_link in indicator.sources
    ]

    related_indicator_ids = set()

    for campaign in indicator.campaigns:
        for related_indicator in campaign.indicators:
            if related_indicator.id != indicator_id:
                related_indicator_ids.add(related_indicator.id)

    for source_link in indicator.sources:
        source = source_link.source

        for related_link in source.indicator_links:
            if related_link.indicator_id != indicator_id:
                related_indicator_ids.add(
                    related_link.indicator_id
                )

    return {
        "indicator_id": indicator_id,
        "shared_campaigns": shared_campaigns,
        "shared_sources": shared_sources,
        "related_indicators": sorted(related_indicator_ids),
    }
