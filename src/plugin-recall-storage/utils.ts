import { v4, UUID } from 'uuid';

export async function logMemoryPostgres(
  db: any,
  params: {
    userId: UUID;
    agentId: UUID;
    roomId: UUID;
    type: string;
    body: string;
  },
): Promise<void> {
  // First ensure the room exists
  const roomCheck = await db.query('SELECT id FROM rooms WHERE id = $1', [params.roomId]);
  if (roomCheck.rows.length === 0) {
    // If room doesn't exist, create it
    await db.query('INSERT INTO rooms (id) VALUES ($1)', [params.roomId]);
  }

  // Now we can safely insert the log
  await db.query(
    `INSERT INTO logs (id, body, "userId", "agentId", "roomId", type, "isSynced")
       VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
    [v4(), params.body, params.userId, params.agentId, params.roomId, params.type],
  );
}

export async function logMemorySqlite(
  db: any,
  params: {
    userId: UUID;
    agentId: UUID;
    roomId: UUID;
    type: string;
    body: string;
  },
): Promise<void> {
  const sql = `
            INSERT INTO logs (id, userId, agentId, roomId, type, body, isSynced)
            VALUES (?, ?, ?, ?, ?, ?, 0)
        `;
  db.prepare(sql).run(v4(), params.userId, params.agentId, params.roomId, params.type, params.body);
}
