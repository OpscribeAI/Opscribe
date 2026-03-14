from uuid import UUID
from datetime import datetime
from sqlmodel import Session, select
from apps.api.models import Graph, Node, Edge
from apps.api.infrastructure.rag.models import KnowledgeBaseItem
from apps.api.infrastructure.rag.embeddings import EmbeddingService

class GraphIngestor:
    def __init__(self, session: Session):
        self.session = session
        self.embedding_service = EmbeddingService()

    def ingest_graph(self, graph_id: UUID):
        # 1. Fetch Graph Data
        graph = self.session.get(Graph, graph_id)
        if not graph:
            raise ValueError(f"Graph with ID {graph_id} not found")

        # 2. Process Nodes
        for node in graph.nodes:
            self._process_node(node, graph.client_id)

        # 3. Process Edges
        for edge in graph.edges:
            self._process_edge(edge, graph.client_id)
            
        self.session.commit()

    def _process_node(self, node: Node, tenant_id: UUID):
        # Create text representation of the node
        node_type_name = node.node_type.name if node.node_type else "Unknown Type"
        display = node.display_name or node.key
        text_content = f"Component: {display} ({node_type_name}). "
        
        if node.properties:
            text_content += f"Properties: {node.properties}. "
        
        # Generate embedding
        embedding = self.embedding_service.generate_embedding(text_content)

        # Create/Update KnowledgeBaseItem
        # Check if exists to update or create new (simplified for now: always create/append)
        # ideally we should dedup or update existing items
        
        item = KnowledgeBaseItem(
            tenant_id=tenant_id,
            graph_id=node.graph_id,
            entity_id=node.id,
            content=text_content,
            embedding=embedding,
            metadata_={"type": "node", "node_type": node_type_name, "node_key": node.key},
            created_at=datetime.utcnow().isoformat(),
            updated_at=datetime.utcnow().isoformat()
        )
        self.session.add(item)

    def _process_edge(self, edge: Edge, tenant_id: UUID):
        # We need to fetch source and target node labels for context
        source = self.session.get(Node, edge.from_node_id)
        target = self.session.get(Node, edge.to_node_id)
        
        if not source or not target:
            return

        source_display = source.display_name or source.key
        target_display = target.display_name or target.key
        edge_type_name = edge.edge_type.name if edge.edge_type else "Unknown Relation"

        text_content = f"Connection: {source_display} interacts with {target_display}. "
        text_content += f"Type: {edge_type_name}. "
        if edge.properties:
            text_content += f"Details: {edge.properties}."

        embedding = self.embedding_service.generate_embedding(text_content)

        item = KnowledgeBaseItem(
            tenant_id=tenant_id,
            graph_id=edge.graph_id,
            entity_id=edge.id,
            content=text_content,
            embedding=embedding,
            metadata_={"type": "edge", "relation": edge_type_name},
            created_at=datetime.utcnow().isoformat(),
            updated_at=datetime.utcnow().isoformat()
        )
        self.session.add(item)
