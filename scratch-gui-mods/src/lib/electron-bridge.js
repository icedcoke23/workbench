/**
 * Electron 工作台桥接辅助模块
 *
 * 当 scratch-gui 运行在 Electron 工作台的 BrowserWindow 内时，
 * preload 脚本会在 window 上注入 `scratchBridge` 对象。
 * 本模块对桥接能力做统一封装，并暴露 `isInElectronWorkbench` 标志，
 * 供 sb3-downloader、menu-bar、local-resource-library 等模块判断使用。
 */

// window.scratchBridge 的形态（与主进程 preload/scratch.ts 对应）
/**
 * @typedef {Object} ScratchBridge
 * @property {(projectJson: unknown, fileName?: string) => void} saveProject
 * @property {() => void} requestResources
 * @property {(cb: (resources: Array<{id: string; name: string; type: string; filePath: string}>) => void) => () => void} onResources
 * @property {(cb: (projectJson: unknown) => void) => () => void} onLoadProject
 * @property {(filePath: string) => Promise<{ok: boolean; data?: string; error?: string}>} readResource
 */

/** @returns {ScratchBridge | null} */
export function getScratchBridge () {
    if (typeof window === 'undefined') return null;
    return /** @type {any} */ (window).scratchBridge || null;
}

/** 是否运行在 Electron 工作台内（即桥接已注入） */
export const isInElectronWorkbench = !!getScratchBridge();

/**
 * 把 base64 字符串转为 Uint8Array（供 costumeUpload / soundUpload 使用）
 * @param {string} base64
 * @returns {Uint8Array}
 */
export function base64ToUint8 (base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * 根据文件扩展名推断 MIME 类型
 * @param {string} filePath
 * @returns {string}
 */
export function mimeFromPath (filePath) {
    const ext = (filePath.split('.').pop() || '').toLowerCase();
    switch (ext) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'svg': return 'image/svg+xml';
    case 'gif': return 'image/gif';
    case 'bmp': return 'image/bmp';
    case 'wav': return 'audio/wav';
    case 'mp3': return 'audio/mp3';
    default: return 'application/octet-stream';
    }
}

/**
 * 判断资源是否为音频
 * @param {string} filePath
 * @returns {boolean}
 */
export function isAudioResource (filePath) {
    const ext = (filePath.split('.').pop() || '').toLowerCase();
    return ['wav', 'mp3'].includes(ext);
}
