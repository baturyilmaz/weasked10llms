import mongoose, { Schema, type Document } from 'mongoose';

// Interface for the structure of a single answer within a puzzle
interface IAnswer {
  answer: string;
  points: number;
}

// Interface for the Puzzle document (including Mongoose Document properties)
export interface IPuzzle extends Document {
  puzzleId: string; // Unique identifier for the puzzle (e.g., based on date/question hash)
  question: string;
  answers: IAnswer[];
  date: Date; // Date the puzzle was generated/intended for
  createdAt: Date;
}

// Define the schema for the individual answers
const AnswerSchema: Schema = new Schema({
  answer: { type: String, required: true },
  points: { type: Number, required: true },
}, { _id: false }); // Don't create a separate _id for subdocuments

// Define the main Puzzle schema
const PuzzleSchema: Schema = new Schema({
  puzzleId: { type: String, required: true, unique: true, index: true },
  question: { type: String, required: true },
  answers: [AnswerSchema], // Array of answer subdocuments
  date: { type: Date, required: true, index: true }, // Index date for efficient lookup
  createdAt: { type: Date, default: Date.now },
});

// Create and export the Mongoose model
const Puzzle = mongoose.model<IPuzzle>('Puzzle', PuzzleSchema);

export default Puzzle; 