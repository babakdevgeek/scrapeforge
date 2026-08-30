import { prisma } from './lib/db.js';
import { examples } from './examples/index.js';

/** Load the bundled example scrapers so a fresh install is not an empty shell. */
async function seed() {
  for (const example of examples) {
    const existing = await prisma.scraper.findFirst({ where: { name: example.name } });
    if (existing) {
      console.log(`skip  ${example.name} (already present)`);
      continue;
    }
    const config = JSON.stringify(example.config, null, 2);
    await prisma.scraper.create({
      data: {
        name: example.name,
        description: example.description,
        mode: example.mode,
        config,
        tags: ['example', example.mode].join(','),
        versions: { create: { version: 1, config, note: 'Bundled example' } },
      },
    });
    console.log(`added ${example.name}`);
  }
  await prisma.$disconnect();
}

seed().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
