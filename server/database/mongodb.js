const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      retryWrites: true
    });
    
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    
    // Create indexes for better performance
    await createIndexes();
    
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

// Create indexes for commonly queried fields
const createIndexes = async () => {
  try {
    // These will be created only if they don't exist
    const models = mongoose.models;
    
    if (models.User) {
      await models.User.collection.createIndex({ discord_id: 1 }, { unique: true });
    }
    
    if (models.ApplicationResponse) {
      await models.ApplicationResponse.collection.createIndex({ user_id: 1 });
      await models.ApplicationResponse.collection.createIndex({ application_form_id: 1 });
      await models.ApplicationResponse.collection.createIndex({ status: 1 });
    }
    
    if (models.ApplicationForm) {
      await models.ApplicationForm.collection.createIndex({ is_active: 1 });
    }
    
    if (models.AdminWhitelist) {
      await models.AdminWhitelist.collection.createIndex({ discord_id: 1 }, { unique: true });
    }
    
    console.log('✅ Database indexes created or verified');
  } catch (error) {
    console.warn('⚠️ Error creating indexes:', error.message);
  }
};

module.exports = connectDB;