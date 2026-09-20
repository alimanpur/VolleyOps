import mongoose from 'mongoose';

const { Schema } = mongoose;

const courtSchema = new Schema(
  {
    tournament: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },
    name: { type: String, required: true, trim: true }, // e.g. "Court 1"
    location: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Court = mongoose.model('Court', courtSchema);
