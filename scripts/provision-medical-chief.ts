import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

interface ProvisionedChiefRecord {
  userId: string;
  email: string;
  displayName: string;
  role: 'MEDICAL_CHIEF';
  crewId: 'MCC-ALL';
  accountStatus: 'ACTIVE';
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  passwordUpdatedAt: string;
}

const STORE_DIR = path.resolve(process.cwd(), 'server-data');
const STORE_PATH = path.join(STORE_DIR, 'medical-chief-auth.json');
const DEFAULT_CHIEF_EMAIL = (
  process.env.MEDICAL_CHIEF_EMAIL || 'manikantadindawar21@gmail.com'
)
  .trim()
  .toLowerCase();

function hashPasswordScrypt(password: string): string {
  const saltHex = crypto.randomBytes(16).toString('hex');
  const derivedHex = crypto.scryptSync(password, saltHex, 64).toString('hex');
  return `scrypt$${saltHex}$${derivedHex}`;
}

async function readPasswordFromStdin(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    terminal: false
  });
  for await (const line of rl) {
    rl.close();
    return line;
  }
  return '';
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const allowOverwrite = args.has('--rotate');
  const fromStdin = args.has('--stdin');

  if (fs.existsSync(STORE_PATH) && !allowOverwrite) {
    console.error(
      `[AstroGuard Provision] Refusing to overwrite existing Medical Chief account at ${STORE_PATH}. Pass --rotate to update password hash explicitly.`
    );
    process.exit(1);
  }

  let password = process.env.CHIEF_PROVISION_PASSWORD || '';
  if (fromStdin) {
    password = await readPasswordFromStdin();
  }

  const normalizedPassword = password.replace(/\r?\n$/, '');
  if (!normalizedPassword || normalizedPassword.length < 6 || normalizedPassword.length > 256) {
    console.error(
      '[AstroGuard Provision] Provide a password between 6 and 256 characters via --stdin or CHIEF_PROVISION_PASSWORD.'
    );
    process.exit(1);
  }

  let existing: ProvisionedChiefRecord | null = null;
  if (fs.existsSync(STORE_PATH)) {
    existing = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as ProvisionedChiefRecord;
  }

  const now = new Date().toISOString();
  const record: ProvisionedChiefRecord = {
    userId: existing?.userId || 'MCC_CHIEF_PRIMARY',
    email: existing?.email || DEFAULT_CHIEF_EMAIL,
    displayName: existing?.displayName || 'Dr. M. Thorne (Medical Chief)',
    role: 'MEDICAL_CHIEF',
    crewId: 'MCC-ALL',
    accountStatus: 'ACTIVE',
    passwordHash: hashPasswordScrypt(normalizedPassword),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    passwordUpdatedAt: now
  };

  fs.mkdirSync(STORE_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(STORE_PATH, JSON.stringify(record, null, 2) + '\n', { mode: 0o600 });
  console.log(
    `[AstroGuard Provision] Medical Chief account ${existing ? 'rotated' : 'provisioned'} cleanly (${record.email}, SCRYPT hash stored).`
  );
}

void main();
