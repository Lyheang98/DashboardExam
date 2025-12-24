/**
 * Global cache handlers that can be accessed from anywhere
 * This allows the Header DataControls to trigger page-specific refreshes
 */

type RefreshHandler = () => void;
type WarmCacheHandler = () => Promise<void>;
type ClearCacheHandler = () => void;

class CacheHandlers {
  private refreshHandler: RefreshHandler | null = null;
  private warmCacheHandler: WarmCacheHandler | null = null;
  private clearCacheHandler: ClearCacheHandler | null = null;

  setRefreshHandler(handler: RefreshHandler) {
    this.refreshHandler = handler;
  }

  setWarmCacheHandler(handler: WarmCacheHandler) {
    this.warmCacheHandler = handler;
  }

  setClearCacheHandler(handler: ClearCacheHandler) {
    this.clearCacheHandler = handler;
  }

  clearHandlers() {
    this.refreshHandler = null;
    this.warmCacheHandler = null;
    this.clearCacheHandler = null;
  }

  getRefreshHandler(): RefreshHandler | null {
    return this.refreshHandler;
  }

  getWarmCacheHandler(): WarmCacheHandler | null {
    return this.warmCacheHandler;
  }

  getClearCacheHandler(): ClearCacheHandler | null {
    return this.clearCacheHandler;
  }
}

export const cacheHandlers = new CacheHandlers();

