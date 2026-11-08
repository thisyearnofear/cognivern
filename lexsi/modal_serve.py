"""Modal app: serve CohereLabs/aya-expanse-8b via vLLM for the Lexsi eval.

Deploy:
    modal deploy lexsi/modal_serve.py

The web endpoint URL is printed on deploy; pass it to run_baseline.py as
LEXSI_MODEL_ENDPOINT (…/v1) and LEXSI_SERVED_MODEL=aya-expanse-8b.

Cost note: L40S (~$1.95/hr) is enough for 8B bf16 + moderate KV cache.
scaledown_window keeps it warm between eval batches; delete the app when
done (`modal app stop lexsi-aya-serve`) — idle GPUs still bill until scaledown.
"""

import subprocess

import modal

app = modal.App("lexsi-aya-serve")

# Post-repair eval serves the SFT-merged model produced by modal_train.py on
# the lexsi-artifacts volume. Set MODEL back to the HF id for baseline reruns.
MODEL = "/artifacts/aya-expanse-8b-lexsi-v3"
SERVED_NAME = "aya-expanse-8b-lexsi-v3"
PORT = 8000
artifacts = modal.Volume.from_name("lexsi-artifacts")

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("vllm")
    .env(
        {
            "VLLM_ALLOW_LONG_MAX_MODEL_LEN": "1",
            "VLLM_USE_FLASHINFER_SAMPLER": "0",
        }
    )
)

hf_secret = modal.Secret.from_name("hf-token")


@app.cls(
    image=image,
    gpu="L40S",
    secrets=[hf_secret],
    volumes={"/artifacts": artifacts},
    scaledown_window=20 * 60,
    timeout=60 * 60,
)
@modal.concurrent(max_inputs=16)
class VLLMServer:
    @modal.enter()
    def start(self) -> None:
        subprocess.Popen(
            [
                "vllm",
                "serve",
                MODEL,
                "--served-model-name",
                SERVED_NAME,
                "--host",
                "0.0.0.0",
                "--port",
                str(PORT),
                "--max-model-len",
                "32768",
                "--gpu-memory-utilization",
                "0.92",
                "--enable-prefix-caching",
                "--enforce-eager",
            ]
        )

    @modal.web_server(PORT, startup_timeout=20 * 60)
    def web(self) -> None:
        """Port marker — vLLM (spawned in enter()) owns the listener."""
