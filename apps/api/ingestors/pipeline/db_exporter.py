"""
Database Exporter — Persists infrastructure nodes natively into the Operations Database (PostgreSQL).
"""
from typing import List, Optional
import logging
from sqlmodel import Session, select

from apps.api.database import engine
from apps.api.ingestors.pipeline.base import BaseExporter
from apps.api.ingestors.aws.schemas import DiscoveryResult
from apps.api.models import Graph, Node, NodeType

logger = logging.getLogger(__name__)

class DbExporter(BaseExporter):
    @property
    def backend_name(self) -> str:
        return "postgresql"

    async def export(
        self,
        client_id: str,
        results: List[DiscoveryResult],
        label: Optional[str] = None,
    ) -> str:
        with Session(engine) as session:
            # 1. Resolve or Create the Target Graph
            graph_name = label if label else "Infrastructure Discovery"
            existing_graph = session.exec(
                select(Graph).where(
                    Graph.client_id == client_id,
                    Graph.name == graph_name
                )
            ).first()

            if not existing_graph:
                existing_graph = Graph(
                    client_id=client_id,
                    name=graph_name,
                    description="Automatically generated via Database Pipeline Exporter",
                    settings={}
                )
                session.add(existing_graph)
                session.commit()
                session.refresh(existing_graph)
            
            graph_id = existing_graph.id

            # Cache NodeTypes to avoid constant lookups
            node_type_cache = {}

            # 2. Iterate Results and inject Nodes directly bypassing MinIO/S3
            total_nodes = 0
            for result in results:
                for d_node in result.nodes:
                    role_name = d_node.properties.get("role", "component")
                    
                    # Ensure NodeType exists for this role
                    if role_name not in node_type_cache:
                        nt = session.exec(
                            select(NodeType).where(
                                NodeType.graph_id == graph_id,
                                NodeType.name == role_name
                            )
                        ).first()
                        if not nt:
                            nt = NodeType(
                                client_id=client_id,
                                graph_id=graph_id,
                                name=role_name,
                                description=f"Auto-discovered {role_name} component."
                            )
                            session.add(nt)
                            session.commit()
                            session.refresh(nt)
                        node_type_cache[role_name] = nt
                    
                    # Ensure Node is Upserted
                    existing_node = session.exec(
                        select(Node).where(
                            Node.graph_id == graph_id,
                            Node.key == d_node.key
                        )
                    ).first()

                    if not existing_node:
                        new_node = Node(
                            client_id=client_id,
                            graph_id=graph_id,
                            node_type_id=node_type_cache[role_name].id,
                            key=d_node.key,
                            display_name=d_node.display_name,
                            properties=d_node.properties,
                            source=result.source,
                            source_metadata=d_node.source_metadata
                        )
                        session.add(new_node)
                    else:
                        existing_node.properties.update(d_node.properties)
                        session.add(existing_node)
                    
                    total_nodes += 1

            session.commit()
            logger.info(f"DbExporter successfully ingested {total_nodes} nodes into Graph '{graph_name}'.")
            
        return f"graph_{graph_id}"
