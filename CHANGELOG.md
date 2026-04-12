# Changelog

## [0.1.7](https://github.com/MonsieurBarti/hippo-memory-pi/compare/hippo-memory-pi-v0.1.6...hippo-memory-pi-v0.1.7) (2026-04-12)


### Bug Fixes

* use explicit .js suffixes on relative imports (esm compliance) ([380eede](https://github.com/MonsieurBarti/hippo-memory-pi/commit/380eedea9e25b2e2a02d821de854433538f27743))
* use explicit .js suffixes on relative imports (ESM compliance) ([effb497](https://github.com/MonsieurBarti/hippo-memory-pi/commit/effb4970caac55c66e89aeb97460ba525f4f1ad9))

## [0.1.6](https://github.com/MonsieurBarti/hippo-memory-pi/compare/hippo-memory-pi-v0.1.5...hippo-memory-pi-v0.1.6) (2026-04-12)


### Features

* **skill:** compress hippo-memory skill.md to symbolic level ([06f0273](https://github.com/MonsieurBarti/hippo-memory-pi/commit/06f0273278acfbbfe5f3dea21662fb52f5c9236e))
* **skill:** compress hippo-memory SKILL.md to symbolic level ([cb816b7](https://github.com/MonsieurBarti/hippo-memory-pi/commit/cb816b70fea84307374191b6b7df17ac6f1bf6a6))

## [0.1.5](https://github.com/MonsieurBarti/hippo-memory-pi/compare/hippo-memory-pi-v0.1.4...hippo-memory-pi-v0.1.5) (2026-04-12)


### Features

* add factory for hippo-memory service with owned-instance lifecycle ([e2cfb5b](https://github.com/MonsieurBarti/hippo-memory-pi/commit/e2cfb5b9a2a948280b34e2cd7035404fa986220d))
* add named library exports from src/index ([5e94f40](https://github.com/MonsieurBarti/hippo-memory-pi/commit/5e94f4055b9ccae558da9c8301cebb4286b8d4b0))
* expose hippo-memory service as a library for sibling PI extensions ([cc9476a](https://github.com/MonsieurBarti/hippo-memory-pi/commit/cc9476a87d3500785bee39cf4e8a4c6bc212bce4))
* publish hippo-memory service to globalthis registry for sibling extensions ([0b524f0](https://github.com/MonsieurBarti/hippo-memory-pi/commit/0b524f0cb909146ff778101bfc62f7e157fc2445))


### Bug Fixes

* make release() idempotent and actually exercise process.cwd default in tests ([bc799fd](https://github.com/MonsieurBarti/hippo-memory-pi/commit/bc799fd26159c15a67659fe9e568804e6491e2d4))
* only publish ready service to registry and clean up test sqlite handles ([f3a8b7d](https://github.com/MonsieurBarti/hippo-memory-pi/commit/f3a8b7d3b3fa81ad6a62635b04ec377ab965d69e))
* properly delete env var in test restoration path ([7a0ba66](https://github.com/MonsieurBarti/hippo-memory-pi/commit/7a0ba6673abe23443c9a3ec8d1d429660d236cff))

## [0.1.4](https://github.com/MonsieurBarti/hippo-memory-pi/compare/hippo-memory-pi-v0.1.3...hippo-memory-pi-v0.1.4) (2026-04-11)


### Features

* add update notification on session start ([c405ead](https://github.com/MonsieurBarti/hippo-memory-pi/commit/c405ead9dbf0cd84b99823c90dce9b8583e3ab98))
* add update notification on session_start ([4123900](https://github.com/MonsieurBarti/hippo-memory-pi/commit/41239000b92c35d62f70e9a3fe4aac25ecf1df6b))

## [0.1.3](https://github.com/MonsieurBarti/hippo-memory-pi/compare/hippo-memory-pi-v0.1.2...hippo-memory-pi-v0.1.3) (2026-04-11)


### Features

* add readOnly classification to tool definitions ([075af18](https://github.com/MonsieurBarti/hippo-memory-pi/commit/075af18c4e4f45097c9c5e031fd012568624a8fc))
* add readOnly classification to tool definitions ([5b7d9cf](https://github.com/MonsieurBarti/hippo-memory-pi/commit/5b7d9cf873a060f15233661009d79dde132ca1c4))

## [0.1.2](https://github.com/MonsieurBarti/hippo-memory-pi/compare/hippo-memory-pi-v0.1.1...hippo-memory-pi-v0.1.2) (2026-04-10)


### Bug Fixes

* **release:** use npm_config_token + point at config/manifest files ([f3a6b27](https://github.com/MonsieurBarti/hippo-memory-pi/commit/f3a6b278c1d20ca5cfb174ad6ebd7a6aa0c68717))
* **release:** use npm_config_token env var for bun publish ([a4b764c](https://github.com/MonsieurBarti/hippo-memory-pi/commit/a4b764c56b3a52c4e0473b8ed227a7933cc28ea8))

## [0.1.1](https://github.com/MonsieurBarti/hippo-memory-pi/compare/hippo-memory-pi-v0.1.0...hippo-memory-pi-v0.1.1) (2026-04-10)


### Features

* **commands:** add 6 slash commands with fake-context fixture ([61014bf](https://github.com/MonsieurBarti/hippo-memory-pi/commit/61014bfe913d99fbefa5127e8550a201304bdff7))
* **core:** add types, config, paths, and mutex primitives ([f35e507](https://github.com/MonsieurBarti/hippo-memory-pi/commit/f35e507951029abcb17298b552820fc3f0824b3a))
* **helpers:** add context-injector, error-capture, success-detector ([26580e8](https://github.com/MonsieurBarti/hippo-memory-pi/commit/26580e811822d69b86062402fbfa83ecd1575ee2))
* hippo-memory-pi extension — bio-inspired long-term memory for PI ([4129da3](https://github.com/MonsieurBarti/hippo-memory-pi/commit/4129da31c02ecc5bdab6ed1319920aeacf98d496))
* **hooks:** add 5 lifecycle hooks for session, agent, tool events ([eab3c88](https://github.com/MonsieurBarti/hippo-memory-pi/commit/eab3c882d81d75f19d28ddf2f5622e731316f0f7))
* **index:** wire extension entry point with session state + pi adapters ([f2c33e0](https://github.com/MonsieurBarti/hippo-memory-pi/commit/f2c33e0b534d90c42ed2178783e54fcd652f12ba))
* **memory-service:** add memory-service interface and test fixtures ([2170d4c](https://github.com/MonsieurBarti/hippo-memory-pi/commit/2170d4c379ffa87ad35dfcbaf0a0749ebd962246))
* **memory-service:** hippo-backed init/shutdown with global fallback ([d65a743](https://github.com/MonsieurBarti/hippo-memory-pi/commit/d65a743ae8f539e9cbe2293b4d0dfc912da93b59))
* **memory-service:** implement capture and retrieval methods ([f88d1e2](https://github.com/MonsieurBarti/hippo-memory-pi/commit/f88d1e23cb4b114f17f9e715bc28a18436c23554))
* **memory-service:** implement mutation, sleep, wm, share, learn ([f6e2d88](https://github.com/MonsieurBarti/hippo-memory-pi/commit/f6e2d88191ed5699fb835cf3338c535c9972787f))
* **memory-service:** track new-memories counter and last-sleep timestamp ([c4f8460](https://github.com/MonsieurBarti/hippo-memory-pi/commit/c4f846072208b86b82ea4c3da3a7ff473982b051))
* persistent sleep metrics, skill discovery, release config ([b43a5d2](https://github.com/MonsieurBarti/hippo-memory-pi/commit/b43a5d2ddb5736c8710834a103e3a2578b56ba26))
* **skill:** add hippo memory skill in roxabi compress notation ([4b35aba](https://github.com/MonsieurBarti/hippo-memory-pi/commit/4b35abaddd3c0cf326531deaf63ea1294e50ec2d))
* **skill:** register skill via resources_discover hook ([3b14cf5](https://github.com/MonsieurBarti/hippo-memory-pi/commit/3b14cf54fee23b5f96eb884be21f3dc0c79a7781))
* **status:** wire newsincelastsleep and lasteepat to hippo's sqlite tables ([b20402c](https://github.com/MonsieurBarti/hippo-memory-pi/commit/b20402cc3cc1cbaeeab1ba463955f374ea0520ec))
* **tools:** add 17 tff-memory_ tools with fake-service tests ([661d471](https://github.com/MonsieurBarti/hippo-memory-pi/commit/661d471896b6290442913bc129d54cf1aabad024))


### Bug Fixes

* **config:** sanitize file input, accept case-insensitive booleans ([eff4a9f](https://github.com/MonsieurBarti/hippo-memory-pi/commit/eff4a9fc781a635d7160bb02f0647b10abb95b72))
* **paths-test:** use delete for env cleanup ([6b4c349](https://github.com/MonsieurBarti/hippo-memory-pi/commit/6b4c3495656151bf895285c84b087c31022ab6be))
* **release:** add pre-major bump flags for 0.x versioning ([8fe1684](https://github.com/MonsieurBarti/hippo-memory-pi/commit/8fe16843c41b075b037eb56750e776ab6cf41c0f))
* **release:** add pre-major bump flags for 0.x versioning ([0a80f87](https://github.com/MonsieurBarti/hippo-memory-pi/commit/0a80f874b8a4edc50d7ba53f0c8df22f09e472ea))
* **release:** point workflow at config + manifest files ([60184ad](https://github.com/MonsieurBarti/hippo-memory-pi/commit/60184ad2d4909b97b334ee2dfae0182a58822559))
* **release:** point workflow at config + manifest files ([cb3136a](https://github.com/MonsieurBarti/hippo-memory-pi/commit/cb3136a2c59120e511aa8b5697984e985bdddd18))
* **release:** set manifest to 0.1.0 ([39032e9](https://github.com/MonsieurBarti/hippo-memory-pi/commit/39032e95c775df9fb4d093681eff6b7335e4282a))
* **release:** set manifest to 0.1.0 so next release is 0.2.0 ([2150ef1](https://github.com/MonsieurBarti/hippo-memory-pi/commit/2150ef167ec9bfc5b0dd0a270d5c0bf1f22c3742))
* **skill:** restructure to pi's skill discovery layout (skills/&lt;name&gt;/) ([9b09804](https://github.com/MonsieurBarti/hippo-memory-pi/commit/9b098049c4c0ff36e7e668ce663673d8326d570b))
* update superpowers-state.json paths for hippo-memory-pi ([6823bf2](https://github.com/MonsieurBarti/hippo-memory-pi/commit/6823bf211ef07b8a2171ad80d7723430aef2d8ba))
