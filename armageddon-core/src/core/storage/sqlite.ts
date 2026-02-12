
import Database from 'better-sqlite3';
import { StorageAdapter } from './types';

export class SQLiteStorage implements StorageAdapter {
    private db: Database.Database;

    constructor() {
        this.db = new Database(':memory:');
        this.init();
    }

    private init() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS armageddon_runs (
                run_id TEXT PRIMARY KEY,
                status TEXT,
                verdict TEXT,
                score REAL,
                grade TEXT,
                config TEXT,
                summary TEXT,
                started_at TEXT,
                completed_at TEXT
            );
            CREATE TABLE IF NOT EXISTS armageddon_events (
                event_id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT,
                battery_id TEXT,
                event_type TEXT,
                payload TEXT,
                timestamp TEXT,
                FOREIGN KEY(run_id) REFERENCES armageddon_runs(run_id)
            );
        `);
    }

    async pushEvent(event: any): Promise<void> {
        const stmt = this.db.prepare(`
            INSERT INTO armageddon_events (run_id, battery_id, event_type, payload, timestamp)
            VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run(
            event.runId,
            event.batteryId,
            event.eventType,
            JSON.stringify(event.payload || {}),
            event.timestamp
        );
    }

    async upsertRun(run: any): Promise<void> {
        // Simple UPSERT for SQLite
        const stmt = this.db.prepare(`
            INSERT INTO armageddon_runs (run_id, status, verdict, score, grade, config, summary, started_at, completed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(run_id) DO UPDATE SET
                status=excluded.status,
                verdict=excluded.verdict,
                score=excluded.score,
                grade=excluded.grade,
                config=excluded.config,
                summary=excluded.summary,
                completed_at=excluded.completed_at
        `);

        stmt.run(
            run.runId,
            run.status,
            run.verdict,
            run.score,
            run.grade,
            JSON.stringify(run.config || {}),
            JSON.stringify(run.summary || {}),
            run.startedAt || new Date().toISOString(),
            run.completedAt
        );
    }

    async getRun(runId: string): Promise<any> {
        const run = this.db.prepare('SELECT * FROM armageddon_runs WHERE run_id = ?').get(runId) as any;
        if (!run) return null;

        // Hydrate JSON fields
        return {
            ...run,
            config: JSON.parse(run.config || '{}'),
            summary: JSON.parse(run.summary || '{}')
        };
    }
}
