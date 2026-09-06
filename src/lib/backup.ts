import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { prismaAdmin } from './prisma';
import { deleteObject, listObjectKeys, putObject } from './storage';

// Backup completo da plataforma (todas as lojas, todas as tabelas) — para
// reconstrução em caso de problema grave, não para uso rotineiro do dia a dia
// (isso é o /api/lodges/export, por loja). Roda 1×/dia via cron
// (api/cron/backup-database) e pode ser disparado manualmente em
// /plataforma/backups. Restauração é só por script de linha de comando
// (scripts/restore-backup.ts) — nunca por rota web. Ver AGENTS.md.

const BACKUP_PREFIX = 'backups/';
const RETENTION_DAYS = 30;

// Ordem que respeita as foreign keys — usada tanto pra ler (backup, ordem
// indiferente) quanto pra reescrever (restore, ordem importa). Fonte única
// de verdade pros dois lados, pra nunca divergirem.
export const BACKUP_MODELS = [
  'invitation',
  'lodge',
  'rite',
  'power',
  'office',
  'member',
  'relative',
  'user',
  'chartAccount',
  'account',
  'invoice',
  'payment',
  'asset',
  'bankTransaction',
  'document',
  'messageLog',
  'session',
  'attendance',
  'term',
  'memberOffice',
  'cashClose',
  'balancete',
  'budget',
  'campaign',
  'campaignDonation',
  'rolePermission',
  'subscription',
  'auditLog',
] as const;

export type BackupModelName = (typeof BACKUP_MODELS)[number];

type Row = Record<string, unknown>;
type FindManyDelegate = { findMany: () => Promise<Row[]> };
type CreateManyDelegate = { createMany: (args: { data: Row[]; skipDuplicates?: boolean }) => Promise<{ count: number }> };

// Acesso dinâmico ao delegate do Prisma pelo nome do modelo (string) — o
// client gerado não tem um índice por string, então isolamos o cast aqui,
// num único lugar, em vez de espalhar `any` pelo resto do código.
function delegateFor(model: BackupModelName): FindManyDelegate & CreateManyDelegate {
  return (prismaAdmin as unknown as Record<string, FindManyDelegate & CreateManyDelegate>)[model];
}

function getBackupKey(): Buffer {
  const secret = process.env.BACKUP_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('BACKUP_ENCRYPTION_KEY ausente — configure essa env antes de rodar o backup.');
  }
  return createHash('sha256').update(secret).digest();
}

/** Criptografa (AES-256-GCM). Formato binário: [1B versão][12B iv][16B tag][ciphertext]. */
export function encryptBackup(plaintext: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getBackupKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([1]), iv, tag, ciphertext]);
}

/** Descriptografa um blob gerado por encryptBackup. */
export function decryptBackup(blob: Buffer): Buffer {
  const version = blob[0];
  if (version !== 1) throw new Error(`Versão de backup desconhecida: ${version}`);
  const iv = blob.subarray(1, 13);
  const tag = blob.subarray(13, 29);
  const ciphertext = blob.subarray(29);
  const decipher = createDecipheriv('aes-256-gcm', getBackupKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export interface BackupManifest {
  version: 1;
  createdAt: string;
  models: Partial<Record<BackupModelName, Row[]>>;
}

export interface BackupResult {
  ok: boolean;
  storageKey?: string;
  sizeBytes?: number;
  totalRows?: number;
  modelCounts?: Record<string, number>;
  durationMs: number;
  error?: string;
}

/** Remove do R2 os backups mais antigos que RETENTION_DAYS. */
async function purgeOldBackups(): Promise<void> {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const objects = await listObjectKeys(BACKUP_PREFIX);
  for (const obj of objects) {
    if (obj.lastModified && obj.lastModified.getTime() < cutoff) {
      await deleteObject(obj.key);
    }
  }
}

/** Roda o backup completo: lê todas as tabelas, comprime, criptografa, sobe pro R2 e registra o resultado. */
export async function runFullBackup(): Promise<BackupResult> {
  const startedAt = Date.now();
  try {
    const modelCounts: Record<string, number> = {};
    const models: Partial<Record<BackupModelName, Row[]>> = {};
    let totalRows = 0;

    for (const name of BACKUP_MODELS) {
      const rows = await delegateFor(name).findMany();
      models[name] = rows;
      modelCounts[name] = rows.length;
      totalRows += rows.length;
    }

    const manifest: BackupManifest = { version: 1, createdAt: new Date().toISOString(), models };
    const json = Buffer.from(JSON.stringify(manifest));
    const encrypted = encryptBackup(gzipSync(json));

    const storageKey = `${BACKUP_PREFIX}${new Date().toISOString().replace(/[:.]/g, '-')}.json.gz.enc`;
    const uploaded = await putObject(storageKey, encrypted, 'application/octet-stream');
    if (!uploaded) {
      throw new Error('Storage (R2) não configurado — backup não pôde ser enviado.');
    }

    await purgeOldBackups();

    const durationMs = Date.now() - startedAt;
    await prismaAdmin.backupLog.create({
      data: { storageKey, status: 'success', sizeBytes: encrypted.length, totalRows, modelCounts: JSON.stringify(modelCounts), durationMs },
    });

    return { ok: true, storageKey, sizeBytes: encrypted.length, totalRows, modelCounts, durationMs };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    await prismaAdmin.backupLog.create({ data: { status: 'failed', error: message, durationMs } }).catch(() => {});
    return { ok: false, error: message, durationMs };
  }
}

/** Baixa e decodifica um backup do R2 (usado pelo script de restauração). */
export function decodeBackupBlob(blob: Buffer): BackupManifest {
  const decrypted = decryptBackup(blob);
  const json = gunzipSync(decrypted).toString('utf-8');
  return JSON.parse(json) as BackupManifest;
}

/** Grava as linhas de um modelo (usado só pelo script de restauração). */
export async function restoreModelRows(model: BackupModelName, rows: Row[]): Promise<number> {
  if (rows.length === 0) return 0;
  const result = await delegateFor(model).createMany({ data: rows, skipDuplicates: true });
  return result.count;
}
