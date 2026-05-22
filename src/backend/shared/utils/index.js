/**
 * Shared Utility Functions
 */
export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export function formatBytes(bytes, decimals = 2) {
    if (bytes === 0)
        return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
export function generateId() {
    return Math.random().toString(36).substr(2, 9);
}
export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
export function sanitizeString(str) {
    return str.replace(/[<>]/g, "");
}
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
export function retry(fn, maxAttempts = 3, delay = 1000) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const attempt = async () => {
            try {
                const result = await fn();
                resolve(result);
            }
            catch (error) {
                attempts++;
                if (attempts >= maxAttempts) {
                    reject(error);
                }
                else {
                    setTimeout(attempt, delay * attempts);
                }
            }
        };
        attempt();
    });
}
//# sourceMappingURL=index.js.map
