from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="", tags=["campaigns"])


@router.get("/campaigns", response_model=list[schemas.CampaignResponse])
def get_campaigns(db: Session = Depends(get_db)):
    campaigns = db.query(models.Campaign).all()
    return [
        schemas.CampaignResponse(
            id=campaign.id,
            name=campaign.name,
            description=campaign.description,
            created_at=campaign.created_at,
            indicator_count=len(campaign.indicators),
        )
        for campaign in campaigns
    ]


@router.get("/campaigns/{campaign_id}", response_model=schemas.CampaignResponse)
def get_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return schemas.CampaignResponse(
        id=campaign.id,
        name=campaign.name,
        description=campaign.description,
        created_at=campaign.created_at,
        indicator_count=len(campaign.indicators),
    )


@router.post("/campaigns", response_model=schemas.CampaignResponse)
def create_campaign(campaign: schemas.CampaignCreate, db: Session = Depends(get_db)):
    db_campaign = models.Campaign(name=campaign.name, description=campaign.description)
    db.add(db_campaign)
    db.commit()
    db.refresh(db_campaign)
    return schemas.CampaignResponse(
        id=db_campaign.id,
        name=db_campaign.name,
        description=db_campaign.description,
        created_at=db_campaign.created_at,
        indicator_count=0,
    )


@router.post("/campaigns/{campaign_id}/indicators/{indicator_id}", response_model=schemas.CampaignIndicatorLinkResponse)
def link_indicator_to_campaign(campaign_id: int, indicator_id: int, db: Session = Depends(get_db)):
    campaign = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    indicator = db.query(models.Indicator).filter(models.Indicator.id == indicator_id).first()
    if not indicator:
        raise HTTPException(status_code=404, detail="Indicator not found")

    if indicator in campaign.indicators:
        return schemas.CampaignIndicatorLinkResponse(campaign_id=campaign.id, indicator_id=indicator.id)

    campaign.indicators.append(indicator)
    db.commit()
    return schemas.CampaignIndicatorLinkResponse(campaign_id=campaign.id, indicator_id=indicator.id)
