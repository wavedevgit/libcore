/* tslint:disable */
/* eslint-disable */
export function installLogCallback(error: any, warn: any, info: any, debug: any, trace: any): void;
export function generateLaunchSignature(globals: any): string;
export function initLibdiscore(): Promise<any>;
export function rustMultiply(a: number, b: number): number;
export function crash(): void;
/**
 * The `ReadableStreamType` enum.
 *
 * *This API requires the following crate features to be activated: `ReadableStreamType`*
 */
type ReadableStreamType = "bytes";
/**
 * The membership check `blockeddomainsstore_isBlockedDomain(url)` walks:
 * parse the URL, extract the host, then probe the hash set.
 */
export class BlockedDomainsStore {
  private constructor();
  free(): void;
  static isBlockedDomain(url: string): string | undefined;
  static startFetchingBlockedDomains(delta_url: string): void;
}
/**
 * Zero-sized namespace class used by the original JS API's static methods.
 */
export class ExperimentCacher {
  private constructor();
  free(): void;
  static getConfig(experiment: string): WasmCacheableExperimentConfig | undefined;
  static clearCache(): void;
  static flushToCache(snapshot: string): void;
}
/**
 * The FluxApi object the module exports (wasm-bindgen class `FluxApi`).
 */
export class FluxApi {
  free(): void;
  /**
   * FFI shape recovered from the listing:
   * `fluxapi_connectStore(a:int_ptr, b:externref) -> (int,int,int)`.
   */
  connectStore(connection: any): any;
  dispatchAction(action_json: string, _external: any): any;
  flushReplicationStates(): any;
  getRegisteredActionTypes(): any;
  constructor();
  findStoresThatCanHandleActionType(action: string): any;
}
export class IntoUnderlyingByteSource {
  private constructor();
  free(): void;
  pull(controller: ReadableByteStreamController): Promise<any>;
  start(controller: ReadableByteStreamController): void;
  cancel(): void;
  readonly autoAllocateChunkSize: number;
  readonly type: ReadableStreamType;
}
export class IntoUnderlyingSink {
  private constructor();
  free(): void;
  abort(reason: any): Promise<any>;
  close(): Promise<any>;
  write(chunk: any): Promise<any>;
}
export class IntoUnderlyingSource {
  private constructor();
  free(): void;
  pull(controller: ReadableStreamDefaultController): Promise<any>;
  cancel(): void;
}
/**
 * `struct CacheableExperimentConfig with 1 element` (getter/setter exported as
 * `wbg_get/set_wasmcacheableexperimentconfig_treatmentId`).
 */
export class WasmCacheableExperimentConfig {
  private constructor();
  free(): void;
  treatmentId: number;
}
