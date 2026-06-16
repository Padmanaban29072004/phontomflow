import mongoose from 'mongoose';

const soarAuditSchema = new mongoose.Schema(
  {
    playbook_id: { type: String, required: true },
    action: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    result: { type: String, required: true },
    operator: { type: String, required: true, enum: ['system', 'human'] },
    details: { type: Object },
  },
  { collection: 'soar_audit_logs' }
);

const SoarAuditModel =
  (mongoose.models.SoarAuditLog as mongoose.Model<any>) ||
  mongoose.model('SoarAuditLog', soarAuditSchema);

export async function writePlaybookAuditLog(input: {
  playbook_id: string;
  action: string;
  result: string;
  operator: 'system' | 'human';
  details?: Record<string, unknown>;
}): Promise<void> {
  if (mongoose.connection.readyState !== 1) return;
  await SoarAuditModel.create({
    ...input,
    timestamp: new Date(),
  });
}

