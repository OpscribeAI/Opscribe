from typing import List, Dict, Tuple
import logging
from apps.api.ingestors.aws.schemas import DiscoveryNode, DiscoveryEdge

logger = logging.getLogger(__name__)

class GraphValidator:
    """
    Ensures referential integrity and structural validity of generated graphs.
    """
    
    def sanitize(self, nodes: List[DiscoveryNode], edges: List[DiscoveryEdge]) -> Tuple[List[DiscoveryNode], List[DiscoveryEdge]]:
        """
        Validates the graph by removing duplicate nodes and deleting edges that point to non-existent nodes.
        Returns the sanitized (nodes, edges).
        """
        # 1. Enforce unique node keys
        unique_nodes: Dict[str, DiscoveryNode] = {}
        duplicates = 0
        for node in nodes:
            if node.key not in unique_nodes:
                unique_nodes[node.key] = node
            else:
                duplicates += 1
                
        # 2. Enforce referential integrity for edges
        valid_node_keys = set(unique_nodes.keys())
        valid_edges = []
        broken_edges = 0
        
        for edge in edges:
            if edge.from_node_key in valid_node_keys and edge.to_node_key in valid_node_keys:
                valid_edges.append(edge)
            else:
                broken_edges += 1
                
        if duplicates > 0 or broken_edges > 0:
            logger.warning(f"GraphValidator sanitized graph: removed {duplicates} duplicate nodes and {broken_edges} broken edges.")
            
        return list(unique_nodes.values()), valid_edges
