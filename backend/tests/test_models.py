"""
Unit tests for model utility functions (no GPU / heavy models required).
Run with:  pytest tests/test_models.py -v
"""
import pytest
from unittest.mock import MagicMock, patch


# ── summaryModel.clean_text ───────────────────────────────────────────────────
class TestCleanText:
    def setup_method(self):
        # Import lazily so PyTorch initialisation doesn't block test discovery
        from summaryModel import clean_text
        self.clean_text = clean_text

    def test_removes_page_numbers(self):
        assert "Page 3 of 10" not in self.clean_text("Hello Page 3 of 10 World")

    def test_removes_references(self):
        assert "[1]"  not in self.clean_text("See [1] and [23] for details")
        assert "[23]" not in self.clean_text("See [1] and [23] for details")

    def test_removes_urls(self):
        text = self.clean_text("Visit https://example.com for more.")
        assert "https://" not in text

    def test_removes_doi(self):
        text = self.clean_text("doi:10.1000/xyz123 is the reference")
        assert "doi:" not in text

    def test_collapses_whitespace(self):
        text = self.clean_text("hello   world\n\n\nfoo")
        assert "  " not in text

    def test_preserves_content(self):
        content = "The quick brown fox jumps."
        assert "quick brown fox" in self.clean_text(content)


# ── summaryModel.chunk_text ───────────────────────────────────────────────────
class TestChunkText:
    def setup_method(self):
        from summaryModel import chunk_text
        self.chunk_text = chunk_text

    def test_short_text_single_chunk(self):
        mock_tokenizer = MagicMock()
        mock_tokenizer.tokenize.return_value = ["tok"] * 5
        # Must be > 50 chars to pass chunk_text's filter
        text = "This is a sufficiently long sentence that will definitely survive the fifty-character filter."
        chunks = self.chunk_text(text, mock_tokenizer, chunk_size=900)
        assert len(chunks) >= 1

    def test_filters_empty_chunks(self):
        mock_tokenizer = MagicMock()
        mock_tokenizer.tokenize.return_value = []
        chunks = self.chunk_text("   ", mock_tokenizer)
        assert all(len(c.strip()) > 50 for c in chunks)

    def test_returns_list(self):
        mock_tokenizer = MagicMock()
        mock_tokenizer.tokenize.return_value = ["tok"]
        result = self.chunk_text("A sentence. Another sentence.", mock_tokenizer)
        assert isinstance(result, list)


# ── translationModel.translate_text_core ─────────────────────────────────────
class TestTranslation:
    def test_unsupported_language_raises(self):
        from translationModel import translate_text_core
        with pytest.raises((ValueError, RuntimeError)):
            translate_text_core("Hello world", "xx")  # 'xx' is not in LANGUAGE_MODEL_MAP

    def test_language_map_has_13_entries(self):
        from translationModel import LANGUAGE_MODEL_MAP
        assert len(LANGUAGE_MODEL_MAP) == 13

    def test_all_expected_languages_present(self):
        from translationModel import LANGUAGE_MODEL_MAP
        expected = {"de", "es", "fr", "ru", "ja", "ar", "zh", "pt", "it", "nl", "ko", "pl", "sv"}
        assert expected == set(LANGUAGE_MODEL_MAP.keys())


# ── qaModel utilities ─────────────────────────────────────────────────────────
class TestQaModel:
    def test_load_pdf_text_missing_file(self):
        # Import inside the test to avoid module-level side-effects during collection
        import importlib
        import sys
        # Temporarily import only the function we need
        try:
            from qaModel import load_pdf_text_with_pages
            with pytest.raises(Exception):  # FileNotFoundError or ValueError
                load_pdf_text_with_pages("/nonexistent/path/file.pdf")
        except ImportError as e:
            pytest.skip(f"qaModel import failed (expected in isolated test env): {e}")
