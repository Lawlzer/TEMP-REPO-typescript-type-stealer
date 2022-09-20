import dotenv from 'dotenv';
import fs from 'fs-extra';
import path from 'path';

// Jest does not allow us to use dotenv, mongoose, or app.listen() in tests -- However, on Jest initialization, it's fine.
// So, we must run initialization code (dotenv, mongoose, app.listen()) here.  Then, for Jest supertests, we can simply import run_server.ts :)

// NODE_ENV must be set to production or development (or test, but this file shouldn't be ran with Jest)
// export async function beforeAll(() {
// 	console.log('beforeAll called!');
// });

export default async function () {
	// Use dotenv to inject environment variables
	const environmentName = process.env.NODE_ENV;
	if (environmentName !== 'test') throw new Error(`Unexpected process.env.NODE_ENV: ${environmentName}`);

	const environmentPath = path.resolve(`.env.${environmentName}`);
	if (!fs.existsSync(environmentPath)) throw new Error(`src/index.ts: Could not find environment file at ${environmentPath}`);
	console.info('Using the environment: ' + environmentName);
	dotenv.config({ path: environmentPath });

	// // Initialize a MongoDB connection
	// if (typeof process.env.MONGO_DB_ROUTE !== 'string') throw new Error('process.env.MONGO_DB_ROUTE is not a string');
	// await mongoose.connect(process.env.MONGO_DB_ROUTE);

	// // Delete every collection (as we are on the test branch)
	// const collections = await mongoose.connection.db.collections();
	// console.log('collections: ', collections);
	// await Promise.all(
	// 	await collections.map(async (collection) => {
	// 		console.log('Collection deleted: ' + collection.collectionName);
	// 		await collection.deleteMany({});
	// 	})
	// );
}

// https://mswjs.io/
