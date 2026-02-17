from typing import List, Optional, Type, Any
from uuid import UUID
from pydantic import BaseModel, Field
from langchain.tools import BaseTool
from sqlmodel import Session, select

from apps.api.database import get_session
from apps.api.models import Node, Edge, NodeType, Graph
from apps.api.infrastructure.rag.retriever import GraphRetriever
from apps.api import schemas

class CreateNodeInput(BaseModel):
    name: str = Field(description="Name of the node")
    node_type_id: UUID = Field(description="UUID of the node type")
    graph_id: UUID = Field(description="UUID of the graph")
    properties: dict = Field(description="Properties of the node")
    client_id: UUID = Field(description="UUID of the client")

class CreateNodeTool(BaseTool):
    name: str = "create_node"
    description: str = "Creates a new node in the graph. Requires name, node_type_id, graph_id, client_id, and properties."
    args_schema: Type[BaseModel] = CreateNodeInput

    def _run(self, name: str, node_type_id: UUID, graph_id: UUID, properties: dict, client_id: UUID) -> str:
        # We'll use a new session per call for safety.
        # Note: In a real production app, we should refactor the heavy-lifting logic from routers into services 
        # to avoid duplicating logic or direct DB access here. 
        # For now, we will interact directly with the DB models as a first pass.
        
        session_gen = get_session()
        session = next(session_gen)
        try:
            # Check if node type exists
            node_type = session.get(NodeType, node_type_id)
            if not node_type:
                return f"Error: NodeType with ID {node_type_id} not found."

            # Create Node
            node = Node(
                name=name,
                node_type_id=node_type_id,
                graph_id=graph_id,
                client_id=client_id,
                properties=properties
            )
            session.add(node)
            try:
                session.commit()
                session.refresh(node)
                return f"Node created successfully with ID: {node.id}"
            except Exception as commit_error:
                session.rollback()
                return f"Database error creating node: {str(commit_error)}"
        except Exception as e:
            return f"Error processing create_node: {str(e)}"
        finally:
            session.close()

class ListNodesInput(BaseModel):
    limit: int = Field(default=10, description="Max number of items to return")

class ListNodesTool(BaseTool):
    name: str = "list_nodes"
    description: str = "Lists existing nodes in the database."
    args_schema: Type[BaseModel] = ListNodesInput

    def _run(self, limit: int = 10) -> str:
        session_gen = get_session()
        session = next(session_gen)
        try:
            nodes = session.exec(select(Node).limit(limit)).all()
            # Serialize simple representation
            return str([{ "id": str(n.id), "name": n.name, "type_id": str(n.node_type_id) } for n in nodes])
        except Exception as e:
            return f"Error listing nodes: {str(e)}"
        finally:
            session.close()

class RAGInput(BaseModel):
    query: str = Field(description="The query to search in the knowledge base")
    tenant_id: UUID = Field(description="The client/tenant UUID to scope the search")

class RAGTool(BaseTool):
    name: str = "rag_search"
    description: str = "Searches the knowledge base for relevant context using RAG."
    args_schema: Type[BaseModel] = RAGInput

    def _run(self, query: str, tenant_id: UUID) -> str:
        session_gen = get_session()
        session = next(session_gen)
        try:
            # Assuming GraphRetriever is available and works as inspected
            retriever = GraphRetriever(session)
            results = retriever.retrieve(query, tenant_id)
            if not results:
                return "No relevant information found in the knowledge base."
            return "\n---\n".join([item.content for item in results])
        except Exception as e:
            return f"Error searching knowledge base: {str(e)}"
        finally:
            session.close()
