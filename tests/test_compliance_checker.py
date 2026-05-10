from universal_llm.compliance_checker import check_compliance


def test_detect_pii_in_response():
    response = "Patient John Doe with SSN 123-45-6789"
    is_compliant, issues = check_compliance(response)
    assert not is_compliant
    assert "PII detected" in issues


def test_legal_citation_required():
    response = "EU law requires X"
    is_compliant, issues = check_compliance(response, rules={"legal_requires_citation": True})
    assert not is_compliant


def test_compliant_response():
    response = "According to EU GDPR Article 33 [source], companies must notify..."
    is_compliant, issues = check_compliance(response, rules={"legal_requires_citation": True})
    assert is_compliant
