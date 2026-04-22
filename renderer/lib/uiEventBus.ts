type UIEventCallback = () => void;

const listeners: Record<string, UIEventCallback[]> = {
  openPalette: [],
  openMemory: [],
  openSettings: [],
  openGalaxy: [],
};

export const uiEventBus = {
  onOpenPalette(cb: UIEventCallback) {
    listeners.openPalette.push(cb);
    return () => {
      listeners.openPalette = listeners.openPalette.filter((fn) => fn !== cb);
    };
  },

  onOpenMemory(cb: UIEventCallback) {
    listeners.openMemory.push(cb);
    return () => {
      listeners.openMemory = listeners.openMemory.filter((fn) => fn !== cb);
    };
  },

  onOpenSettings(cb: UIEventCallback) {
    listeners.openSettings.push(cb);
    return () => {
      listeners.openSettings = listeners.openSettings.filter((fn) => fn !== cb);
    };
  },

  onOpenGalaxy(cb: UIEventCallback) {
    listeners.openGalaxy.push(cb);
    return () => {
      listeners.openGalaxy = listeners.openGalaxy.filter((fn) => fn !== cb);
    };
  },

  emitOpenPalette() {
    listeners.openPalette.forEach((cb) => cb());
  },

  emitOpenMemory() {
    listeners.openMemory.forEach((cb) => cb());
  },

  emitOpenSettings() {
    listeners.openSettings.forEach((cb) => cb());
  },

  emitOpenGalaxy() {
    listeners.openGalaxy.forEach((cb) => cb());
  },
};
