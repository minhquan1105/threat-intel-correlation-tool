from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.services.correlation import build_graph_data

router = APIRouter(prefix="", tags=["graph"])


@router.get("/graph", response_model=schemas.GraphResponse)
def get_graph(db: Session = Depends(get_db)):
    graph = build_graph_data(db)
    return schemas.GraphResponse(nodes=[schemas.GraphNode(**node) for node in graph["nodes"]], edges=[schemas.GraphEdge(**edge) for edge in graph["edges"]])
