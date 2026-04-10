# Changelog

## 1.0.0 (2026-04-10)


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
* **skill:** add hippo memory skill in roxabi compress notation ([4b35aba](https://github.com/MonsieurBarti/hippo-memory-pi/commit/4b35abaddd3c0cf326531deaf63ea1294e50ec2d))
* **skill:** register skill via resources_discover hook ([3b14cf5](https://github.com/MonsieurBarti/hippo-memory-pi/commit/3b14cf54fee23b5f96eb884be21f3dc0c79a7781))
* **status:** wire newsincelastsleep and lasteepat to hippo's sqlite tables ([b20402c](https://github.com/MonsieurBarti/hippo-memory-pi/commit/b20402cc3cc1cbaeeab1ba463955f374ea0520ec))
* **tools:** add 17 tff-memory_ tools with fake-service tests ([661d471](https://github.com/MonsieurBarti/hippo-memory-pi/commit/661d471896b6290442913bc129d54cf1aabad024))


### Bug Fixes

* **config:** sanitize file input, accept case-insensitive booleans ([eff4a9f](https://github.com/MonsieurBarti/hippo-memory-pi/commit/eff4a9fc781a635d7160bb02f0647b10abb95b72))
* **paths-test:** use delete for env cleanup ([6b4c349](https://github.com/MonsieurBarti/hippo-memory-pi/commit/6b4c3495656151bf895285c84b087c31022ab6be))
* **skill:** restructure to pi's skill discovery layout (skills/&lt;name&gt;/) ([9b09804](https://github.com/MonsieurBarti/hippo-memory-pi/commit/9b098049c4c0ff36e7e668ce663673d8326d570b))
* update superpowers-state.json paths for hippo-memory-pi ([6823bf2](https://github.com/MonsieurBarti/hippo-memory-pi/commit/6823bf211ef07b8a2171ad80d7723430aef2d8ba))
