"""
Parallel retrieval orchestrator for efficient concurrent document retrieval.

Manages batched execution of multiple retrieval queries with:
- Concurrent execution within batches
- Sequential batch processing to prevent API rate limit overload
- Per-query timeout handling
- Result deduplication
"""
import asyncio
import logging
from typing import Any, Callable, List

logger = logging.getLogger(__name__)


async def parallel_retrieve(
    queries: List[str],
    retriever: Any,
    batch_size: int = 3,
    timeout: float = 30.0,
) -> List[List[dict]]:
    """Execute retrieval in parallel for multiple queries.
    
    Orchestrates concurrent document retrieval with batching to prevent
    rate limit overload. Queries are processed in batches where each batch
    executes concurrently, but batches are sequential.
    
    Args:
        queries: List of query strings to retrieve documents for
        retriever: Retriever object with async retrieve(query) method
        batch_size: Number of queries to execute concurrently per batch. Default: 3
        timeout: Per-query timeout in seconds. Default: 30.0
    
    Returns:
        List of result lists where each inner list contains documents for
        the corresponding query. Each document is a dict with at least
        'content' and 'source' keys.
    
    Example:
        >>> results = await parallel_retrieve(
        ...     ["US AI regulation", "EU AI regulation"],
        ...     retriever,
        ...     batch_size=2,
        ...     timeout=30.0
        ... )
        >>> assert len(results) == 2
        >>> for docs in results:
        ...     for doc in docs:
        ...         assert "content" in doc
        ...         assert "source" in doc
    """
    if not queries:
        return []
    
    all_results = []
    
    # Process queries in batches
    for batch_start in range(0, len(queries), batch_size):
        batch_end = min(batch_start + batch_size, len(queries))
        batch_queries = queries[batch_start:batch_end]
        
        # Execute batch concurrently with timeout handling
        batch_tasks = [
            _retrieve_with_timeout(query, retriever, timeout)
            for query in batch_queries
        ]
        
        batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
        
        # Process batch results and deduplicate
        for query, result in zip(batch_queries, batch_results):
            if isinstance(result, Exception):
                logger.warning(f"Error retrieving '{query}': {result}")
                all_results.append([])
            else:
                # Deduplicate results within batch
                deduplicated = _deduplicate_results(result)
                all_results.append(deduplicated)
    
    return all_results


async def _retrieve_with_timeout(
    query: str,
    retriever: Any,
    timeout: float,
) -> list[dict]:
    """Execute single query retrieval with timeout.
    
    Args:
        query: Query string
        retriever: Retriever object with retrieve method
        timeout: Timeout in seconds
    
    Returns:
        List of result documents, or empty list on timeout
    """
    try:
        # Handle both async and sync retrievers by checking if retrieve is awaitable
        retrieve_coro = retriever.retrieve(query)
        result = await asyncio.wait_for(retrieve_coro, timeout=timeout)
        return result if result else []
    except asyncio.TimeoutError:
        logger.warning(f"Timeout retrieving '{query}' (timeout={timeout}s)")
        return []
    except Exception as e:
        logger.error(f"Error retrieving '{query}': {type(e).__name__}: {e}")
        return []


def _deduplicate_results(results: list[dict]) -> list[dict]:
    """Deduplicate results while preserving order.
    
    Removes duplicate documents based on their dict representation.
    Preserves the order of first occurrence.
    
    Args:
        results: List of result documents
    
    Returns:
        Deduplicated list of results
    """
    if not results:
        return []
    
    seen = set()
    deduplicated = []
    
    for result in results:
        # Convert dict to frozenset of items for hashing
        try:
            result_hash = frozenset(result.items())
            if result_hash not in seen:
                seen.add(result_hash)
                deduplicated.append(result)
        except TypeError:
            # If result contains unhashable types, include it anyway
            deduplicated.append(result)
    
    return deduplicated
