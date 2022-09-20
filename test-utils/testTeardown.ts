import mongoose from 'mongoose';

// Because we are using Jest, the connection to Mongo isn't actually closed -- So we must manually close it here
export default async function () {
	// kill the Mongo connection
	await mongoose.connection.close();
}
