import mongoose from 'mongoose';
import 'dotenv/config';

const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    console.error('❌ Error: MONGODB_URI is not defined in .env file');
    process.exit(1); // Exit process with failure code
  }

  try {
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB Connected...');
  } catch (err) {
    // Assert err is an Error instance for better type checking
    if (err instanceof Error) {
        console.error('❌ MongoDB Connection Error:', err.message);
    } else {
        console.error('❌ MongoDB Connection Error: An unknown error occurred');
    }
    // Exit process with failure code
    process.exit(1);
  }
};

export default connectDB; 