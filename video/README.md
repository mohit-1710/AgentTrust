# NEAR hackathon demo video

This is the source edit for the AgentTrust NEAR demo. [brief.md](brief.md) maps every on-screen claim to the saved r4 proof, the separate direct-call tests and the open limit. [narration.md](narration.md) is the spoken script; [cues.json](cues.json) times each subtitle sentence against the generated narration.

The dated images and short WebM clips in `assets/` are 1920×1080 captures of the public AgentTrust landing and read-only Decisions page from 13 November 2026. The clips show two actual page interactions: expanding the saved model B payment and the separate direct A refusal. They make no new payment or model call. The final card uses the existing `web/public/media/agenttrust-hero-poster.png`. `render.py` combines these captures, the public synthetic fixture values and allowlisted r4 evidence into legible cards. The cards are editorial summaries; the embedded Decisions footage is an actual public page capture. The model, MCP, provider servers and issuer used in the r4 evidence ran locally/project-operated. The two direct tests are visibly separate from the model purchase.

## Local render

The voice uses [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0) through [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) (MIT), with the `af_heart` voice. The source model and voices are downloaded from the package author's `model-files-v1.1` release. They are kept under ignored `video/work/`.

```sh
uv venv --python 3.12 video/work/venv
uv pip install --python video/work/venv/bin/python kokoro-onnx==0.6.1 soundfile==0.14.0 pillow==13.0.0
curl --fail --location --output video/work/kokoro-v1.0.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/kokoro-v1.0.onnx
curl --fail --location --output video/work/voices-v1.0.bin https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/voices-v1.0.bin
shasum -a 256 video/work/kokoro-v1.0.onnx video/work/voices-v1.0.bin
video/work/venv/bin/python video/make_voice.py
video/work/venv/bin/python video/render.py --stills-only
video/work/venv/bin/python video/render.py
```

The checked local model SHA-256 was `beb0d1848dee9a49da392cc3df26958d46cfa35d321edf434f52949153f0df3a`; voices SHA-256 was `bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d`. The output is ignored `video/final/agenttrust-near-demo.mp4`. It has no API call or chain transaction in its render path. `make_voice.py` regenerates ignored audio, and the subtitle cue times must be realigned if the narration changes.

The 13 November handoff MP4 is 125.800 seconds, 1920×1080/30 fps H.264/AAC, 7,732,949 bytes, with SHA-256 `410308d6c326947502e9be7735c3604626eb8dbcb48f65008bd6605eb8bdd850`. `video/final/agenttrust-near-cover.png` is a clean opening-card cover. Both are ignored local outputs; the video is attached to the eventual human X post.

`record_public_decisions.py` is the optional isolated Chromium capture source for the two dated WebM assets. It only reads the public page. The committed clips are the exact inputs for this video, so rendering does not depend on the current public feed or a browser session.

The provided ElevenLabs key was confirmed as a free account. [ElevenLabs says free-plan output has no commercial-use rights](https://elevenlabs.io/docs/overview/administration/billing), so its audio was not used in this public product video. No key is stored in this package.

## Review boundary

The artifact is meant for the human team to review, publish on X and attach to the NEAR submission. It is not posted or submitted by these scripts. The official [hackathon instructions](https://nearhackathon.com/HACKATHON.md) require a public reproducible repository and human X demo post. The repository was private when this edit began; verify anonymous access before posting its source link. The video links public docs proof and quickstart routes that were already live.
