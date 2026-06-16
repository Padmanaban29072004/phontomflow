import mongoose from 'mongoose';
import { UnifiedEventSchema } from '../types';

const assetSchema = new mongoose.Schema(
  {
    asset_id: String,
    ip: String,
    hostname: String,
    owner: String,
    environment: String,
    criticality_score: { type: Number, default: 1 },
  },
  { strict: false, collection: 'asset_inventory' }
);

const AssetModel =
  (mongoose.models.AssetInventory as mongoose.Model<any>) ||
  mongoose.model('AssetInventory', assetSchema);

export async function enrichWithAssetContext(event: UnifiedEventSchema): Promise<UnifiedEventSchema> {
  if (mongoose.connection.readyState !== 1) {
    return {
      ...event,
      asset: {
        criticality_score: 1,
      },
    };
  }

  const asset = await AssetModel.findOne({ $or: [{ ip: event.src_ip }, { hostname: event.host }] }).lean();
  if (!asset) {
    return {
      ...event,
      asset: {
        criticality_score: 1,
      },
    };
  }

  return {
    ...event,
    asset: {
      asset_id: asset.asset_id,
      hostname: asset.hostname,
      owner: asset.owner,
      environment: asset.environment,
      criticality_score: Number(asset.criticality_score ?? 1),
    },
  };
}

