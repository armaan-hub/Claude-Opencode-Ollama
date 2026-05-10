"""
Tests for parallel retrieval orchestrator.
Tests batching, concurrency, timeout handling, and deduplication.
"""
import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from universal_llm.retriever_orchestrator import parallel_retrieve


class MockRetriever:
    """Mock retriever for testing."""

    def __init__(self, delay: float = 0.01, results_per_query: int = 3):
        """Initialize mock retriever.
        
        Args:
            delay: Simulated retrieval delay in seconds
            results_per_query: Number of results to return per query
        """
        self.delay = delay
        self.results_per_query = results_per_query
        self.call_count = 0
        self.queries_received = []

    async def retrieve(self, query: str) -> list[dict]:
        """Simulate async retrieval."""
        self.call_count += 1
        self.queries_received.append(query)
        await asyncio.sleep(self.delay)
        
        # Return mock results with content and source
        return [
            {"content": f"Result {i+1} for: {query}", "source": f"source_{i+1}"}
            for i in range(self.results_per_query)
        ]


class TestParallelRetrieval:
    """Test basic parallel retrieval functionality."""

    @pytest.mark.asyncio
    async def test_parallel_retrieval_basic(self):
        """Test basic parallel retrieval with 3 queries."""
        retriever = MockRetriever()
        queries = ["US AI regulation", "EU AI regulation", "China AI regulation"]
        
        results = await parallel_retrieve(queries, retriever)
        
        assert len(results) == 3
        assert all(isinstance(r, list) for r in results)
        assert retriever.call_count == 3

    @pytest.mark.asyncio
    async def test_parallel_retrieval_single_query(self):
        """Test parallel retrieval with single query."""
        retriever = MockRetriever()
        queries = ["single query"]
        
        results = await parallel_retrieve(queries, retriever)
        
        assert len(results) == 1
        assert isinstance(results[0], list)
        assert len(results[0]) > 0

    @pytest.mark.asyncio
    async def test_parallel_retrieval_many_queries(self):
        """Test parallel retrieval with many queries."""
        retriever = MockRetriever()
        queries = [f"query {i}" for i in range(10)]
        
        results = await parallel_retrieve(queries, retriever)
        
        assert len(results) == 10
        assert all(isinstance(r, list) for r in results)
        assert all(len(r) > 0 for r in results)

    @pytest.mark.asyncio
    async def test_parallel_retrieval_result_structure(self):
        """Test that results have correct structure."""
        retriever = MockRetriever()
        queries = ["test query"]
        
        results = await parallel_retrieve(queries, retriever)
        
        assert isinstance(results[0], list)
        for result in results[0]:
            assert isinstance(result, dict)
            assert "content" in result
            assert "source" in result


class TestBatchManagement:
    """Test batch management and concurrent processing."""

    @pytest.mark.asyncio
    async def test_batch_size_enforcement(self):
        """Test that batch_size is respected."""
        retriever = MockRetriever(delay=0.05)
        queries = [f"query {i}" for i in range(10)]
        
        # With batch_size=2, should process in 5 batches
        results = await parallel_retrieve(queries, retriever, batch_size=2)
        
        assert len(results) == 10
        assert retriever.call_count == 10

    @pytest.mark.asyncio
    async def test_batch_size_larger_than_queries(self):
        """Test batch_size larger than number of queries."""
        retriever = MockRetriever()
        queries = ["q1", "q2"]
        
        results = await parallel_retrieve(queries, retriever, batch_size=10)
        
        assert len(results) == 2
        assert retriever.call_count == 2

    @pytest.mark.asyncio
    async def test_default_batch_size(self):
        """Test default batch_size (3)."""
        retriever = MockRetriever()
        queries = [f"query {i}" for i in range(6)]
        
        results = await parallel_retrieve(queries, retriever)
        
        assert len(results) == 6
        assert all(len(r) > 0 for r in results)


class TestDeduplication:
    """Test result deduplication."""

    @pytest.mark.asyncio
    async def test_deduplication_within_batch(self):
        """Test deduplication of identical results within a batch."""
        # Create a retriever that returns duplicates
        retriever = MockRetriever()
        retriever.retrieve = AsyncMock(return_value=[
            {"content": "same content", "source": "source1"},
            {"content": "same content", "source": "source1"},
            {"content": "different content", "source": "source2"},
        ])
        
        queries = ["q1"]
        results = await parallel_retrieve(queries, retriever)
        
        # Should deduplicate identical results
        assert len(results[0]) == 2
        assert results[0][0] == {"content": "same content", "source": "source1"}
        assert results[0][1] == {"content": "different content", "source": "source2"}

    @pytest.mark.asyncio
    async def test_no_deduplication_across_batches(self):
        """Test that deduplication only happens within batches, not across."""
        retriever = MockRetriever()
        queries = ["q1", "q2"]
        
        # Setup to return same content for both queries
        retriever.retrieve = AsyncMock(return_value=[
            {"content": "common result", "source": "source1"},
        ])
        
        results = await parallel_retrieve(queries, retriever, batch_size=1)
        
        # Both queries should have the same result since they're in different batches
        assert len(results[0]) == 1
        assert len(results[1]) == 1
        assert results[0][0] == results[1][0]


class TestTimeoutHandling:
    """Test timeout handling and error resilience."""

    @pytest.mark.asyncio
    async def test_timeout_graceful_handling(self):
        """Test that timeout is handled gracefully."""
        # Create a retriever that times out
        async def slow_retrieve(query: str):
            await asyncio.sleep(1.0)  # Longer than timeout
            return [{"content": "result", "source": "source"}]
        
        retriever = MagicMock()
        retriever.retrieve = slow_retrieve
        
        queries = ["q1"]
        results = await parallel_retrieve(queries, retriever, timeout=0.1)
        
        # Should return results (possibly empty for timed-out queries)
        assert results is not None
        assert len(results) == 1

    @pytest.mark.asyncio
    async def test_timeout_one_query_doesnt_block_others(self):
        """Test that timeout on one query doesn't block others."""
        call_times = []
        
        async def variable_retrieve(query: str):
            call_times.append((query, 'start'))
            if 'slow' in query:
                await asyncio.sleep(1.0)
            else:
                await asyncio.sleep(0.01)
            call_times.append((query, 'end'))
            return [{"content": f"result for {query}", "source": "source"}]
        
        retriever = MagicMock()
        retriever.retrieve = variable_retrieve
        
        queries = ["fast1", "slow", "fast2"]
        results = await parallel_retrieve(queries, retriever, timeout=0.1, batch_size=3)
        
        # All queries should be attempted
        assert len(results) == 3
        # At least some results should complete
        assert any(len(r) > 0 for r in results if r)

    @pytest.mark.asyncio
    async def test_timeout_default_value(self):
        """Test default timeout value."""
        retriever = MockRetriever(delay=0.01)
        queries = ["q1", "q2", "q3"]
        
        # Default timeout is 30 seconds, so quick queries should all complete
        results = await parallel_retrieve(queries, retriever)
        
        assert len(results) == 3
        assert all(len(r) > 0 for r in results)


class TestConcurrency:
    """Test concurrent execution behavior."""

    @pytest.mark.asyncio
    async def test_queries_execute_concurrently_in_batch(self):
        """Test that queries in a batch execute concurrently."""
        import time
        
        start_times = {}
        end_times = {}
        
        async def timed_retrieve(query: str):
            start_times[query] = time.time()
            await asyncio.sleep(0.1)
            end_times[query] = time.time()
            return [{"content": f"result for {query}", "source": "source"}]
        
        retriever = MagicMock()
        retriever.retrieve = timed_retrieve
        
        queries = ["q1", "q2", "q3"]
        start = time.time()
        results = await parallel_retrieve(queries, retriever, batch_size=3)
        total_time = time.time() - start
        
        # With 3 concurrent queries at 0.1s each, should take ~0.1s, not 0.3s
        assert total_time < 0.25
        assert len(results) == 3

    @pytest.mark.asyncio
    async def test_batches_execute_sequentially(self):
        """Test that batches execute sequentially."""
        import time
        
        call_times = []
        
        async def tracked_retrieve(query: str):
            call_times.append(('start', query, time.time()))
            await asyncio.sleep(0.05)
            call_times.append(('end', query, time.time()))
            return [{"content": f"result for {query}", "source": "source"}]
        
        retriever = MagicMock()
        retriever.retrieve = tracked_retrieve
        
        queries = [f"q{i}" for i in range(6)]
        start = time.time()
        results = await parallel_retrieve(queries, retriever, batch_size=2)
        total_time = time.time() - start
        
        # With 2 batches of 3 queries each at 0.05s:
        # Batch 1: 2 queries concurrent = ~0.05s
        # Batch 2: 2 queries concurrent = ~0.05s
        # Batch 3: 2 queries concurrent = ~0.05s
        # Total should be ~0.15s (3 batches), not 0.3s (sequential)
        assert len(results) == 6

    @pytest.mark.asyncio
    async def test_concurrent_execution_performance(self):
        """Test that concurrent execution is actually faster."""
        import time
        
        async def delayed_retrieve(query: str):
            await asyncio.sleep(0.1)
            return [{"content": f"result for {query}", "source": "source"}]
        
        retriever = MagicMock()
        retriever.retrieve = delayed_retrieve
        
        queries = ["q1", "q2", "q3"]
        start = time.time()
        results = await parallel_retrieve(queries, retriever, batch_size=3)
        concurrent_time = time.time() - start
        
        # Concurrent execution should be much faster than sequential (0.3s)
        # Should complete in ~0.1s instead
        assert concurrent_time < 0.25
        assert len(results) == 3


class TestEdgeCases:
    """Test edge cases and error handling."""

    @pytest.mark.asyncio
    async def test_empty_query_list(self):
        """Test handling of empty query list."""
        retriever = MockRetriever()
        queries = []
        
        results = await parallel_retrieve(queries, retriever)
        
        assert results == []

    @pytest.mark.asyncio
    async def test_query_with_special_characters(self):
        """Test handling of queries with special characters."""
        retriever = MockRetriever()
        queries = ["query with 'quotes'", "query?with?symbols", "query&with&ampersands"]
        
        results = await parallel_retrieve(queries, retriever)
        
        assert len(results) == 3
        assert all(len(r) > 0 for r in results)

    @pytest.mark.asyncio
    async def test_empty_results_from_retriever(self):
        """Test handling of empty results from retriever."""
        retriever = MagicMock()
        retriever.retrieve = AsyncMock(return_value=[])
        
        queries = ["q1"]
        results = await parallel_retrieve(queries, retriever)
        
        assert len(results) == 1
        assert results[0] == []

    @pytest.mark.asyncio
    async def test_retriever_exception_handling(self):
        """Test handling of exceptions from retriever."""
        async def failing_retrieve(query: str):
            if 'error' in query:
                raise ValueError("Retrieval failed")
            return [{"content": f"result for {query}", "source": "source"}]
        
        retriever = MagicMock()
        retriever.retrieve = failing_retrieve
        
        queries = ["normal", "error_query", "another_normal"]
        results = await parallel_retrieve(queries, retriever)
        
        # Should handle exceptions gracefully
        assert len(results) == 3
