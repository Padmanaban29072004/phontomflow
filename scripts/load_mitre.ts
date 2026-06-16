import mongoose from 'mongoose';
import axios from 'axios';

const MITRE_STIX_URL =
  'https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json';

async function main(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/phantom-flow';
  await mongoose.connect(mongoUri);

  const response = await axios.get(MITRE_STIX_URL, { timeout: 60000 });
  const data = response.data;
  const collection = mongoose.connection.collection('mitre_attack_stix');

  await collection.deleteMany({});
  const objects = Array.isArray(data?.objects) ? data.objects : [];
  if (objects.length) {
    await collection.insertMany(objects);
  }

  console.log(`Loaded ${objects.length} STIX objects into mitre_attack_stix`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});

