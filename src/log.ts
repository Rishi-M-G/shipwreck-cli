function emit(level: string, event: string, fields: Record<string, unknown>): void {
    const ts = new Date().toISOString();
    const record = {
        ...fields,
        ts,
        level,
        event,
    };

    try {
        process.stderr.write(JSON.stringify(record) + "\n");
    } catch (err) {
        const tempRecord = {
            ts,
            level,
            event,
            logFieldsDropped: true,
            reason: err instanceof Error ? err.message : String(err),
        }
        process.stderr.write(JSON.stringify(tempRecord) + "\n");
    }
}

export const log = {
    info: (event: string, fields: Record<string, unknown> = {}): void =>
        emit("info", event, fields),
    error: (event: string, fields: Record<string, unknown> = {}): void =>
        emit("error", event, fields),
};