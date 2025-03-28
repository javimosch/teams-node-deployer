function logWithDate(prefix, message, ...optionalParams) {
    const date = new Date();
    const dateString = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    switch (prefix.toUpperCase()) {
        case 'LOG':
            originalConsoleLog(`LOG: ${dateString}`, message, ...optionalParams);
            break;
        case 'DEBUG':
            originalConsoleDebug(`DEBUG: ${dateString}`, message, ...optionalParams);
            break;
        case 'WARN':
            originalConsoleWarn(`WARN: ${dateString}`, message, ...optionalParams);
            break;
        case 'ERROR':
            originalConsoleError(`ERROR: ${dateString}`, message, ...optionalParams);
            break;
    }
}

const originalConsoleLog = console.log;
const originalConsoleDebug = console.debug;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

console.log = (message, ...optionalParams) => logWithDate('log', message, ...optionalParams);
console.debug = (message, ...optionalParams) => logWithDate('debug', message, ...optionalParams);
console.warn = (message, ...optionalParams) => logWithDate('warn', message, ...optionalParams);
console.error = (message, ...optionalParams) => logWithDate('error', message, ...optionalParams);
