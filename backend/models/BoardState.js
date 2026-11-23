import mongoose from "mongoose";

const docUpdateSchema = new mongoose.Schema({
  documentId: { type: String, required: true, index: true },
  update: { type: Buffer, required: true },
  seq: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

const snapshotSchema = new mongoose.Schema({
  documentId: { type: String, required: true, index: true },
  state: { type: Buffer, required: true },
  version: { type: Number, required: true },
  label: { type: String, default: "Auto-snapshot" },
  createdBy: { type: String, default: "system" },
  createdAt: { type: Date, default: Date.now },
});

export const DocUpdate = mongoose.model("DocUpdate", docUpdateSchema);
export const Snapshot = mongoose.model("Snapshot", snapshotSchema);