import mongoose from 'mongoose';

export async function killAllCollections() {
	const collections = await mongoose.connection.db.collections();
	await Promise.all(
		await collections.map(async (collection) => {
			await collection.deleteMany({});
		})
	);
}

// We use a "mongoId" so we can use separate databases, so the Jest tests don't collide.
let mongoId = 0;
export async function initMongoose() {
	mongoId++;
	if (typeof process.env.MONGO_DB_ROUTE !== 'string') throw new Error('process.env.MONGO_DB_ROUTE is not a string');
	await mongoose.connect(`${process.env.MONGO_DB_ROUTE}-${mongoId}`);

	// Delete every collection (as we are on the test branch)
	await killAllCollections();
}

export async function clearMongoose() {
	await killAllCollections();
	await mongoose.connection.close();
}
