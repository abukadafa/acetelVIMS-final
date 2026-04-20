const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const uri = "mongodb+srv://abbello_db_user:A0zuJ1wRVhEXtH2l@acetel-cluster.0prij2x.mongodb.net/acetel?retryWrites=true&w=majority";

async function run() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('acetel');
        const users = db.collection('users');

        console.log('Searching for admin...');
        const admin = await users.findOne({ email: 'admin@acetel.ng' });

        const salt = await bcrypt.genSalt(10);
        const hashedHeader = await bcrypt.hash('password123', salt);

        if (admin) {
            console.log('Found old admin. Updating password...');
            await users.updateOne(
                { _id: admin._id },
                { $set: { password: hashedHeader, isActive: true } }
            );
            console.log('✅ Admin password updated successfully!');
        } else {
            console.log('Admin not found. Please ensure the server has run at least once to seed the database.');
        }

    } finally {
        await client.close();
    }
}

run().catch(console.dir);
