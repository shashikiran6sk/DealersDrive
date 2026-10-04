import { createPrisma } from './platform/db/prisma.js';
import { backgroundStatus } from './platform/jobs/status.js';

const prisma = createPrisma();
try {
  process.stdout.write(JSON.stringify(await backgroundStatus(prisma)) + '\n');
} finally {
  await prisma.$disconnect();
}
