from universal_llm.synthesis_engine import generate_report, synthesize_docs


class MockLLMClient:
    def synthesize(self, docs):
        combined = " ".join(doc["content"] for doc in docs)
        return (
            "This synthesis aggregates key facts from retrieved materials. "
            f"Summary of evidence: {combined}. "
            "The narrative highlights scope, obligations, and practical implications "
            "for multi-jurisdiction compliance planning and implementation."
        )


def test_synthesize_retrieved_docs():
    docs = [
        {"content": "US requires X compliance", "source": "doc1"},
        {"content": "EU requires Y compliance", "source": "doc2"},
    ]

    synthesis = synthesize_docs(docs, MockLLMClient())

    assert len(synthesis) > 100
    assert "US" in synthesis
    assert "EU" in synthesis


def test_synthesis_includes_meta():
    docs = [
        {"content": "US requires encryption at rest", "source": "nist_official"},
        {"content": "US requires encryption at rest", "source": "fips_guidance"},
    ]

    result = generate_report(docs, "What encryption is required?", MockLLMClient())

    assert "synthesis" in result
    assert "sources_used" in result
    assert "confidence_score" in result


def test_generate_report_tracks_sources_and_confidence_range():
    docs = [
        {"content": "US requires encryption at rest", "source": "nist_official"},
        {"content": "US requires encryption at rest", "source": "fips_guidance"},
    ]

    result = generate_report(docs, "What encryption is required?", MockLLMClient())

    assert result["sources_used"] == ["nist_official", "fips_guidance"]
    assert isinstance(result["confidence_score"], float)
    assert 0.0 <= result["confidence_score"] <= 1.0
    assert result["confidence_score"] >= 0.9


def test_generate_report_single_weak_source_has_mid_confidence():
    docs = [{"content": "Encryption may be useful", "source": "blog_post"}]

    result = generate_report(docs, "What encryption is required?", MockLLMClient())

    assert 0.5 <= result["confidence_score"] <= 0.7


def test_generate_report_deduplicates_sources_preserving_order():
    docs = [
        {"content": "Control A is required", "source": "nist_official"},
        {"content": "Control A is required", "source": "nist_official"},
        {"content": "Control A is required", "source": "fips_guidance"},
    ]

    result = generate_report(docs, "What control is required?", MockLLMClient())

    assert result["sources_used"] == ["nist_official", "fips_guidance"]
