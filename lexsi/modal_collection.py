"""Add the v7 adapter to the public HF model collection."""

import modal

app = modal.App("lexsi-collection-v7")

image = modal.Image.debian_slim(python_version="3.12").pip_install("huggingface_hub")
hf_secret = modal.Secret.from_name("hf-token")

COLLECTION = "Papajams/lexsi-governed-agent-spend-models"
ITEM = "Papajams/aya-expanse-8b-lexsi-v7"


@app.function(image=image, secrets=[hf_secret], timeout=10 * 60)
def add_item() -> str:
    import os

    from huggingface_hub import HfApi

    HF_TOKEN = ""
    for k, v in os.environ.items():
        if "HF" in k.upper() and "TOKEN" in k.upper():
            HF_TOKEN = v
            break
    api = HfApi(token=HF_TOKEN)
    api.add_collection_item(
        collection_slug=COLLECTION,
        item_id=ITEM,
        item_type="model",
    )
    print(f"added {ITEM} to {COLLECTION}", flush=True)
    return ITEM


@app.local_entrypoint()
def main() -> None:
    print(add_item.remote())
