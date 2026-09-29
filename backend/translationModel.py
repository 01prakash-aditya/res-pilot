from transformers import MarianMTModel, MarianTokenizer
import torch
from functools import lru_cache
from logger import get_logger

logger = get_logger(__name__)

DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
DTYPE = torch.float16 if DEVICE == 'cuda' else torch.float32
BATCH_SIZE = 4
MAX_LENGTH = 512

# 13 supported target languages (expanded from original 5)
LANGUAGE_MODEL_MAP = {
    "de": "de",   # German
    "es": "es",   # Spanish
    "fr": "fr",   # French
    "ru": "ru",   # Russian
    "ja": "ja",   # Japanese
    "ar": "ar",   # Arabic
    "zh": "zh",   # Chinese (Simplified)
    "pt": "pt",   # Portuguese
    "it": "it",   # Italian
    "nl": "nl",   # Dutch
    "ko": "ko",   # Korean
    "pl": "pl",   # Polish
    "sv": "sv",   # Swedish
}

LANGUAGE_NAMES = {
    "de": "German", "es": "Spanish", "fr": "French", "ru": "Russian",
    "ja": "Japanese", "ar": "Arabic", "zh": "Chinese", "pt": "Portuguese",
    "it": "Italian", "nl": "Dutch", "ko": "Korean", "pl": "Polish", "sv": "Swedish",
}


@lru_cache(maxsize=13)
def load_resources(target_lang: str):
    """Load and cache the Helsinki-NLP MarianMT model for a given language."""
    normalized = target_lang.lower()
    if normalized not in LANGUAGE_MODEL_MAP:
        raise ValueError(
            f"Unsupported language '{target_lang}'. "
            f"Supported: {sorted(LANGUAGE_MODEL_MAP.keys())}"
        )
    model_name = f"Helsinki-NLP/opus-mt-en-{LANGUAGE_MODEL_MAP[normalized]}"
    logger.info(f"Loading translation model: {model_name}")
    try:
        tokenizer = MarianTokenizer.from_pretrained(model_name)
        model = MarianMTModel.from_pretrained(model_name, dtype=DTYPE).to(DEVICE).eval()
        logger.info(f"Translation model ready: {model_name}")
        return tokenizer, model
    except Exception as exc:
        logger.error(f"Failed to load {model_name}: {exc}")
        raise RuntimeError(f"Translation model unavailable for '{target_lang}': {exc}")


def translate_text_core(text: str, target_lang: str) -> str:
    """Translate English text to the specified target language."""
    lang_name = LANGUAGE_NAMES.get(target_lang.lower(), target_lang)
    logger.info(f"Translating to {lang_name}...")

    tokenizer, model = load_resources(target_lang.lower())
    text = text.strip()

    def _run_batch(sentences: list) -> list:
        inputs = tokenizer(
            sentences, return_tensors="pt", padding=True,
            truncation=True, max_length=MAX_LENGTH,
        ).to(DEVICE)
        with torch.inference_mode():
            outputs = model.generate(
                **inputs, num_beams=4, early_stopping=True,
                max_length=MAX_LENGTH, length_penalty=1.0,
                repetition_penalty=1.2, do_sample=False,
            )
        return tokenizer.batch_decode(outputs, skip_special_tokens=True)

    # Short texts: translate in one shot
    if len(text) < 500:
        return _run_batch([text])[0]

    # Long texts: split on sentences and translate in batches
    sentences = [s.strip() + "." for s in text.split(". ") if s.strip()]
    translated = []
    for i in range(0, len(sentences), BATCH_SIZE):
        translated.extend(_run_batch(sentences[i:i + BATCH_SIZE]))

    logger.info(f"Translation to {lang_name} complete")
    return " ".join(translated)
