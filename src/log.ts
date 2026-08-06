type Fields = Record<string, unknown>;

function emit(write: (line: string) => void, level: string, event: string, fields: Fields): void {
    write(JSON.stringify({
        level, event, ...fields, time: new Date().toISOString()
    }));
}

export const log = {
    info: (event: string, fields: Fields = {}) => emit(console.log, 'info', event, fields),
    error: (event: string, fields: Fields = {}) => emit(console.error, 'error', event, fields),
};
