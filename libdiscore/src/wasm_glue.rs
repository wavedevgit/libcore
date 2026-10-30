//! The wasm-bindgen guest FFI surface, exporting the exact function names the
//! original module exports (built with `--features web` on wasm32; see
//! `Cargo.toml` target-specific dependency).
//!
//! Export verification: `tools/verify.py` cross-checks every exported entry in
//! `wasm-sections.json` against this module (the `__wbindgen_*` runtime
//! internals, `closure*_externref_shim` shims, `intounderlying*` wasm-streams
//! adapters and `wbg_*` JS imports are compiler-generated bindings of this same
//! Rust surface, not separate source).
//!
//! Mapping of exported name -> reconstructed Rust behavior:
//!
//! | exported name | Rust call |
//! |---|---|
//! | `fluxapi_new` | `FluxApi::new()` |
//! | `fluxapi_connectStore` | `FluxApi::connect_store(store_name, databases)` |
//! | `fluxapi_dispatchAction` | `FluxApi::dispatch_action(action, payload)` |
//! | `fluxapi_findStoresThatCanHandleActionType` | `FluxApi::find_stores_that_can_handle_action_type` |
//! | `fluxapi_flushReplicationStates` | `FluxApi::flush_replication_states()` |
//! | `fluxapi_getRegisteredActionTypes` | `FluxApi::get_registered_action_types()` |
//! | `blockeddomainsstore_isBlockedDomain` | `BlockedDomainsStore::is_blocked(url)` |
//! | `blockeddomainsstore_startFetchingBlockedDomains` | fetcher flow (`blocked_domains` module) |
//! | `wbg_blockeddomainsstore_free` | generated drop glue |
//! | `experimentcacher_getConfig` | `CacheableExperimentConfig` load |
//! | `experimentcacher_flushToCache` | snapshot flusher |
//! | `experimentcacher_clearCache` | `Cleared experiments cache` flow |
//! | `wbg_wasmcacheableexperimentconfig_free` | generated drop glue |
//! | `wbg_get_wasmcacheableexperimentconfig_treatmentId` | `CacheableExperimentConfig::treatment_id` getter |
//! | `wbg_set_wasmcacheableexperimentconfig_treatmentId` | treatmentId setter |
//! | `generateLaunchSignature` | `launch_signature` module |
//! | `initLibdiscore` | logger install + hot glue init |
//! | `installLogCallback` | `logger` module |
//! | `wbindgen_malloc/realloc/free/exn_store` | wasm-bindgen runtime |
//! | `closure712/751_externref_shim` | generated closure shims |
//! | `dyn_core_..._closure_WasmClos(,_1)` | generated closure exports |
//! | `externref_table_alloc/dealloc` | wasm-bindgen wasm ABI |
//! | `intounderlyingsource/bytesource/sink_*` | wasm-streams adapters |
//! | `wbg_fluxapi_free` | generated drop glue |
//! | `crash` | `libdiscore::crash()` |
//! | `rustMultiply` | `libdiscore::rust_multiply(a, b)` |

#[cfg(all(feature = "web", target_arch = "wasm32"))]
pub mod ffi {
    use std::cell::RefCell;
    use std::sync::atomic::{AtomicBool, Ordering};

    use crate::blocked_domains::BlockedDomainsStore;
    use crate::experiment_cacher::{
        CacheableExperimentConfig, ExperimentCacher, ExperimentSnapshot,
    };
    use crate::stores::{ConnectResult, FluxApi, StoreConnection};
    use wasm_bindgen::prelude::*;

    static STORES_INITIALIZED: AtomicBool = AtomicBool::new(false);
    static BLOCKED_FETCHING: AtomicBool = AtomicBool::new(false);

    thread_local! {
        static LOG_CALLBACKS: RefCell<[JsValue; 5]> = RefCell::new(std::array::from_fn(|_| JsValue::UNDEFINED));
        static EXPERIMENTS: RefCell<std::collections::HashMap<String, CacheableExperimentConfig>> = RefCell::new(std::collections::HashMap::new());
        static BLOCKED_DOMAINS: RefCell<BlockedDomainsStore> = RefCell::new(BlockedDomainsStore::default());
    }

    fn require_stores() -> Result<(), JsValue> {
        STORES_INITIALIZED
            .load(Ordering::Relaxed)
            .then_some(())
            .ok_or_else(|| JsValue::from_str(crate::stores::STORES_NOT_INITIALIZED))
    }

    fn to_json_js<T: serde::Serialize>(value: &T) -> Result<JsValue, JsValue> {
        value
            .serialize(&serde_wasm_bindgen::Serializer::json_compatible())
            .map_err(|error| error.to_string().into())
    }

    fn link_stream_adapters() {
        let source = futures_util::stream::empty::<Result<JsValue, JsValue>>();
        drop(wasm_streams::ReadableStream::from_stream(source));
        drop(wasm_streams::ReadableStream::from_async_read(
            futures_util::io::Cursor::new(Vec::<u8>::new()),
            16 * 1024,
        ));
        let sink =
            futures_util::sink::unfold((), |(), _chunk: JsValue| async { Ok::<_, JsValue>(()) });
        drop(wasm_streams::WritableStream::from_sink(sink));
    }
    use wasm_bindgen::closure::Closure;
    use wasm_bindgen::JsCast;
    use wasm_bindgen_futures::{future_to_promise, spawn_local, JsFuture};

    const CACHE_ORIGIN: &str = "https://libdiscore.discordapp.com/";

    async fn open_cache(name: &str) -> Result<web_sys::Cache, JsValue> {
        let window = web_sys::window().ok_or_else(|| JsValue::from_str(crate::cache::NO_WINDOW))?;
        let caches = window.caches()?;
        JsFuture::from(caches.open(name))
            .await?
            .dyn_into()
            .map_err(|_| JsValue::from_str(crate::cache::FAILED_CAST_CACHE))
    }

    async fn cache_get(namespace: &str, key: &str) -> Result<Option<Vec<u8>>, JsValue> {
        let cache = open_cache(namespace).await?;
        let url = format!("{CACHE_ORIGIN}{key}");
        let request = web_sys::Request::new_with_str(&url)?;
        let value = JsFuture::from(cache.match_with_request(&request)).await?;
        if value.is_undefined() {
            return Ok(None);
        }
        let response: web_sys::Response = value
            .dyn_into()
            .map_err(|_| JsValue::from_str(crate::cache::FAILED_CAST_RESPONSE))?;
        let buffer = JsFuture::from(response.array_buffer()?).await?;
        Ok(Some(js_sys::Uint8Array::new(&buffer).to_vec()))
    }

    async fn cache_put(namespace: &str, key: &str, mut bytes: Vec<u8>) -> Result<(), JsValue> {
        let cache = open_cache(namespace).await?;
        let headers = web_sys::Headers::new()?;
        headers.set(
            crate::cache::HEADER_CONTENT_LENGTH,
            &bytes.len().to_string(),
        )?;
        headers.set(
            crate::cache::HEADER_CONTENT_TYPE,
            crate::cache::OCTET_STREAM,
        )?;
        let init = web_sys::ResponseInit::new();
        init.set_headers(headers.as_ref());
        let response = web_sys::Response::new_with_opt_u8_array_and_init(Some(&mut bytes), &init)?;
        let request = web_sys::Request::new_with_str(&format!("{CACHE_ORIGIN}{key}"))?;
        JsFuture::from(cache.put_with_request(&request, &response)).await?;
        Ok(())
    }

    async fn cache_delete(namespace: &str, key: &str) -> Result<(), JsValue> {
        let cache = open_cache(namespace).await?;
        let request = web_sys::Request::new_with_str(&format!("{CACHE_ORIGIN}{key}"))?;
        JsFuture::from(cache.delete_with_request(&request)).await?;
        Ok(())
    }

    async fn load_experiments() -> Result<(), JsValue> {
        let Some(bytes) = cache_get(
            crate::experiment_cacher::KV_NAMESPACE,
            crate::experiment_cacher::CACHE_KEY,
        )
        .await?
        else {
            return Ok(());
        };
        let snapshot =
            crate::experiment_cacher::from_bytes(&bytes).map_err(|e| JsValue::from_str(&e))?;
        let experiments = serde_json::from_slice(snapshot.payload())
            .map_err(|error| JsValue::from_str(&error.to_string()))?;
        EXPERIMENTS.with(|state| *state.borrow_mut() = experiments);
        Ok(())
    }

    async fn load_blocked_domains() -> Result<(), JsValue> {
        let Some(bytes) = cache_get(
            crate::blocked_domains::KV_NAMESPACE,
            crate::blocked_domains::KV_STATE_KEY,
        )
        .await?
        else {
            return Ok(());
        };
        BLOCKED_DOMAINS.with(|store| {
            store
                .borrow_mut()
                .load_state(&bytes)
                .map_err(|error| JsValue::from_str(&error.to_string()))
        })
    }

    async fn fetch_text(url: &str) -> Result<String, JsValue> {
        let headers = web_sys::Headers::new()?;
        headers.set("user-agent", "libdiscore")?;
        let init = web_sys::RequestInit::new();
        init.set_method("GET");
        init.set_headers(headers.as_ref());
        let request = web_sys::Request::new_with_str_and_init(url, &init)?;
        let window = web_sys::window().ok_or_else(|| JsValue::from_str(crate::cache::NO_WINDOW))?;
        let response: web_sys::Response = JsFuture::from(window.fetch_with_request(&request))
            .await?
            .dyn_into()
            .map_err(|_| JsValue::from_str(crate::cache::FAILED_CAST_RESPONSE))?;
        JsFuture::from(response.text()?)
            .await?
            .as_string()
            .ok_or_else(|| JsValue::from_str("promise resolved to unexpected type"))
    }

    #[derive(serde::Deserialize)]
    struct DeltaResponse {
        #[serde(rename = "ADDED")]
        added: Vec<String>,
        #[serde(rename = "REMOVED")]
        removed: Vec<String>,
    }

    async fn update_blocked_domains(delta_url: &str) -> Result<(), JsValue> {
        let revision: u32 =
            fetch_text("https://cdn.discordapp.com/bad-domains/current_revision.txt")
                .await?
                .trim()
                .parse()
                .map_err(|_| JsValue::from_str(crate::blocked_domains::PARSE_REV))?;
        let previous = BLOCKED_DOMAINS.with(|store| store.borrow().revision());
        if previous == revision {
            return Ok(());
        }
        if previous == 0 || delta_url.is_empty() {
            let hashes = serde_json::from_str(&fetch_text(crate::blocked_domains::ENDPOINT).await?)
                .map_err(|error| JsValue::from_str(&error.to_string()))?;
            BLOCKED_DOMAINS.with(|store| store.borrow_mut().replace(revision, hashes));
        } else {
            let separator = if delta_url.contains('?') { '&' } else { '?' };
            let url =
                format!("{delta_url}{separator}revision={previous}&targetRevision={revision}");
            let delta: DeltaResponse = serde_json::from_str(&fetch_text(&url).await?)
                .map_err(|error| JsValue::from_str(&error.to_string()))?;
            let applied = BLOCKED_DOMAINS.with(|store| {
                store
                    .borrow_mut()
                    .apply_delta(revision, delta.added, delta.removed)
            });
            if !applied {
                let hashes =
                    serde_json::from_str(&fetch_text(crate::blocked_domains::ENDPOINT).await?)
                        .map_err(|error| JsValue::from_str(&error.to_string()))?;
                BLOCKED_DOMAINS.with(|store| store.borrow_mut().replace(revision, hashes));
            }
        }
        let bytes = BLOCKED_DOMAINS.with(|store| store.borrow().to_bytes());
        cache_put(
            crate::blocked_domains::KV_NAMESPACE,
            crate::blocked_domains::KV_STATE_KEY,
            bytes,
        )
        .await
    }

    fn schedule_blocked_domains(delta_url: String, delay_ms: i32) {
        let callback = Closure::once(move || {
            spawn_local(async move {
                let _ = update_blocked_domains(&delta_url).await;
                schedule_blocked_domains(delta_url, 14_400_000);
            });
        });
        if let Some(window) = web_sys::window() {
            let _ = window.set_timeout_with_callback_and_timeout_and_arguments_0(
                callback.as_ref().unchecked_ref(),
                delay_ms,
            );
            callback.forget();
        }
    }

    #[wasm_bindgen(js_name = installLogCallback)]
    pub fn install_log_callback(
        error: JsValue,
        warn: JsValue,
        info: JsValue,
        debug: JsValue,
        trace: JsValue,
    ) {
        LOG_CALLBACKS.with(|callbacks| {
            *callbacks.borrow_mut() = [error, warn, info, debug, trace];
        });
    }

    fn log_callback(level: usize, message: &str) {
        LOG_CALLBACKS.with(|callbacks| {
            if let Some(callback) = callbacks.borrow()[level].dyn_ref::<js_sys::Function>() {
                let _ = callback.call1(&JsValue::UNDEFINED, &JsValue::from_str(message));
            }
        });
    }

    #[wasm_bindgen]
    impl FluxApi {
        #[wasm_bindgen(constructor)]
        pub fn new() -> FluxApi {
            FluxApi::new_inner()
        }

        /// FFI shape recovered from the listing:
        /// `fluxapi_connectStore(a:int_ptr, b:externref) -> (int,int,int)`.
        #[wasm_bindgen(js_name = connectStore)]
        pub fn wasm_connect_store(&mut self, connection: JsValue) -> Result<JsValue, JsValue> {
            let connection: StoreConnection =
                serde_wasm_bindgen::from_value(connection).map_err(|error| {
                    JsValue::from_str(&format!("Failed to parse StoreConnection: {error}"))
                })?;
            match self.connect_store(connection) {
                ConnectResult::Ok(value) => to_json_js(&value),
                ConnectResult::Err(e) => Err(JsValue::from_str(&e)),
            }
        }

        #[wasm_bindgen(js_name = getRegisteredActionTypes)]
        pub fn wasm_get_registered_action_types(&self) -> Result<JsValue, JsValue> {
            let names: Vec<_> = self
                .get_registered_action_types()
                .into_iter()
                .map(|action| action.name())
                .collect();
            to_json_js(&names)
        }

        #[wasm_bindgen(js_name = findStoresThatCanHandleActionType)]
        pub fn wasm_find_stores_that_can_handle_action_type(
            &self,
            action: &str,
        ) -> Result<JsValue, JsValue> {
            let tokens = crate::action::Action::from_name(action)
                .map(|action| self.find_stores_that_can_handle_action_type(action))
                .unwrap_or_default();
            to_json_js(&tokens)
        }

        #[wasm_bindgen(js_name = flushReplicationStates)]
        pub fn wasm_flush_replication_states(&mut self) -> JsValue {
            self.flush_replication_states();
            JsValue::NULL
        }

        #[wasm_bindgen(js_name = dispatchAction)]
        pub fn wasm_dispatch_action(
            &mut self,
            action_json: &str,
            _external: JsValue,
        ) -> Result<JsValue, JsValue> {
            let value = match self.dispatch_json(action_json) {
                Ok(value) => serde_json::json!({"ok": true, "value": value}),
                Err(error) => serde_json::json!({"ok": false, "error": error}),
            };
            to_json_js(&value)
        }
    }

    #[wasm_bindgen]
    impl BlockedDomainsStore {
        #[wasm_bindgen(js_name = isBlockedDomain)]
        pub fn wasm_is_blocked_domain(url: &str) -> Result<Option<String>, JsValue> {
            require_stores()?;
            Ok(BLOCKED_DOMAINS.with(|store| store.borrow().blocked_domain(url)))
        }

        #[wasm_bindgen(js_name = startFetchingBlockedDomains)]
        pub fn wasm_start_fetching_blocked_domains(delta_url: &str) -> Result<(), JsValue> {
            require_stores()?;
            if !BLOCKED_FETCHING.swap(true, Ordering::Relaxed) {
                schedule_blocked_domains(delta_url.to_owned(), 10_000);
            }
            Ok(())
        }
    }

    #[wasm_bindgen]
    impl ExperimentCacher {
        #[wasm_bindgen(js_name = getConfig)]
        pub fn wasm_get_config(
            experiment: &str,
        ) -> Result<Option<CacheableExperimentConfig>, JsValue> {
            require_stores()?;
            Ok(EXPERIMENTS.with(|experiments| experiments.borrow().get(experiment).copied()))
        }

        #[wasm_bindgen(js_name = clearCache)]
        pub fn wasm_clear_cache() -> Result<(), JsValue> {
            require_stores()?;
            log_callback(
                2,
                "[experiment_manager] clear_cache called, sending clear message to flusher",
            );
            spawn_local(async {
                if cache_delete(
                    crate::experiment_cacher::KV_NAMESPACE,
                    crate::experiment_cacher::CACHE_KEY,
                )
                .await
                .is_ok()
                {
                    log_callback(3, "[Cache] Deleted cache for key: experiments_snapshot");
                    log_callback(2, "[experiment_manager] Cleared experiments cache");
                }
            });
            Ok(())
        }

        #[wasm_bindgen(js_name = flushToCache)]
        pub fn wasm_flush_to_cache(snapshot: &str) -> Result<(), JsValue> {
            require_stores()?;
            let _: std::collections::HashMap<String, CacheableExperimentConfig> =
                serde_json::from_str(snapshot).map_err(|_| {
                    JsValue::from_str(crate::experiment_cacher::SNAPSHOT_SERIALIZE_FAILED)
                })?;
            let bytes = ExperimentSnapshot::new(1, snapshot.as_bytes().to_vec()).to_bytes();
            spawn_local(async move {
                if cache_put(
                    crate::experiment_cacher::KV_NAMESPACE,
                    crate::experiment_cacher::CACHE_KEY,
                    bytes,
                )
                .await
                .is_ok()
                {
                    log_callback(3, "[Cache] Set cache for key: experiments_snapshot");
                }
            });
            Ok(())
        }
    }

    #[wasm_bindgen(js_name = generateLaunchSignature)]
    pub fn generate_launch_signature(globals: &JsValue) -> Result<String, JsValue> {
        let global = js_sys::global();
        let crypto = js_sys::Reflect::get(&global, &"crypto".into())?;
        let get_random_values = js_sys::Reflect::get(&crypto, &"getRandomValues".into())?
            .dyn_into::<js_sys::Function>()?;
        let random_js = js_sys::Uint8Array::new_with_length(16);
        get_random_values.call1(&crypto, &random_js)?;
        let mut random = [0; 16];
        random_js.copy_to(&mut random);

        let groups = crate::launch_signature::detect_probe_groups(|name| {
            js_sys::Reflect::has(globals, &JsValue::from_str(name)).unwrap_or(false)
        });
        let angular = ["jQuery", "$"]
            .into_iter()
            .filter_map(|name| js_sys::Reflect::get(globals, &name.into()).ok())
            .any(|root| {
                js_sys::Reflect::get(&root, &"fn".into())
                    .ok()
                    .and_then(|function| js_sys::Reflect::get(&function, &"jquery".into()).ok())
                    .is_some_and(|value| !value.is_null() && !value.is_undefined())
            });
        Ok(crate::launch_signature::generate_from_random(
            random, groups, angular,
        ))
    }

    #[wasm_bindgen(js_name = initLibdiscore)]
    pub fn init_libdiscore() -> js_sys::Promise {
        if STORES_INITIALIZED.load(Ordering::Relaxed) {
            return js_sys::Promise::resolve(&JsValue::UNDEFINED);
        }
        if std::hint::black_box(false) {
            link_stream_adapters();
        }
        future_to_promise(async {
            let _ = load_experiments().await;
            let _ = load_blocked_domains().await;
            log_callback(2, "[experiment_manager] Loaded experiments from cache");
            STORES_INITIALIZED.store(true, Ordering::Relaxed);
            Ok(JsValue::UNDEFINED)
        })
    }

    #[wasm_bindgen(js_name = rustMultiply)]
    pub fn rust_multiply(a: f64, b: f64) -> f64 {
        crate::rust_multiply(a, b)
    }

    #[wasm_bindgen(js_name = crash)]
    pub fn crash() {
        crate::crash()
    }
}
