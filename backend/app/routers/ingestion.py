from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.services.ingestion.urlhaus import ingest_urlhaus

router = APIRouter(prefix="", tags=["ingestion"])


@router.post("/ingest/urlhaus", response_model=schemas.IngestionStatsResponse)
def ingest_urlhaus_endpoint(db: Session = Depends(get_db)):
    return ingest_urlhaus(db)
