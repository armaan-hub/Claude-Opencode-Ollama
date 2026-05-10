from universal_llm.citation_injector import deduplicate_citations, inject_citations


def test_inject_inline_citations():
    text = "The EU GDPR requires data notification."
    citations = [{"claim": "EU GDPR requires", "source": "gdpr-doc-1", "url": "https://example.com/gdpr"}]

    result = inject_citations(text, citations, format="inline")

    assert "[source: gdpr-doc-1]" in result or "gdpr-doc-1" in result


def test_inject_footnote_citations():
    text = "AI regulation is complex."
    citations = [{"claim": "AI regulation", "source": "ai-white-paper", "page": 42}]

    result = inject_citations(text, citations, format="footnote")

    assert "[1]" in result
    assert "ai-white-paper" in result


def test_citation_deduplication():
    citations = [
        {"source": "doc1"},
        {"source": "doc1"},
        {"source": "doc2"},
    ]

    unique = deduplicate_citations(citations)

    assert len(unique) == 2
    assert [citation["source"] for citation in unique] == ["doc1", "doc2"]


def test_inject_citations_matches_claim_case_insensitively():
    text = "The eu gdpr requires transparency."
    citations = [{"claim": "EU GDPR REQUIRES", "source": "gdpr-doc-2"}]

    result = inject_citations(text, citations, format="inline")

    assert "gdpr-doc-2" in result


def test_apa_and_ieee_formats_are_supported():
    text = "AI safety standards are evolving."
    citations = [{"claim": "AI safety standards", "source": "std-paper-1"}]

    apa_result = inject_citations(text, citations, format="apa")
    ieee_result = inject_citations(text, citations, format="ieee")

    assert "std-paper-1" in apa_result
    assert "[1]" in ieee_result
