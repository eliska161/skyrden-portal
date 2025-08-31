const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const ApplicationSubmission = require('./models/ApplicationSubmission');
const config = require('./config');

// Create Discord client with necessary intents
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages
  ]
});

// Login the bot with the token
client.login(process.env.DISCORD_BOT_TOKEN);

client.once('ready', () => {
  console.log(`Discord bot logged in as ${client.user.tag}`);
});

// Function to send notification
const sendNotification = async (submission) => {
  try {
    // Get user ID from submission
    const { userId, discordUsername, templateId, status, adminFeedback } = submission;
    
    // Try to fetch user from Discord
    try {
      // Find the user by ID
      const user = await client.users.fetch(userId);
      
      if (!user) {
        console.error(`Could not find Discord user with ID: ${userId}`);
        return false;
      }
      
      // Create an embed for the notification
      const embed = new EmbedBuilder()
        .setTitle(`Application ${status === 'approved' ? 'Approved' : 'Denied'}`)
        .setDescription(`Your application for **${templateId.name}** has been reviewed.`)
        .setColor(status === 'approved' ? '#43B581' : '#F04747')
        .setTimestamp()
        .setFooter({ text: 'Skyrden Application Portal' });
      
      // Add status field
      embed.addFields({
        name: 'Status',
        value: status === 'approved' ? '✅ Approved' : '❌ Denied',
        inline: false
      });
      
      // Add feedback if provided
      if (adminFeedback) {
        embed.addFields({
          name: 'Feedback',
          value: adminFeedback,
          inline: false
        });
      }
      
      // Send DM to the user
      await user.send({ embeds: [embed] });
      
      console.log(`Notification sent to ${discordUsername} (${userId}) for ${templateId.name}`);
      return true;
    } catch (error) {
      console.error(`Error sending notification to user ${userId}:`, error);
      return false;
    }
  } catch (error) {
    console.error('Error in sendNotification:', error);
    return false;
  }
};

// Export function to be used by API
module.exports = {
  sendNotification,
  
  // Function to process pending notifications
  processNotifications: async () => {
    try {
      // Find submissions that need notifications
      const pendingSubmissions = await ApplicationSubmission.find({
        status: { $in: ['approved', 'denied'] },
        notificationSent: false,
        reviewedBy: { $exists: true }
      }).populate('templateId');
      
      console.log(`Processing ${pendingSubmissions.length} pending notifications`);
      
      let sent = 0;
      let failed = 0;
      
      // Process each submission
      for (const submission of pendingSubmissions) {
        const result = await sendNotification(submission);
        
        if (result) {
          // Update the submission to mark notification as sent
          submission.notificationSent = true;
          await submission.save();
          sent++;
        } else {
          failed++;
        }
      }
      
      return { sent, failed };
    } catch (error) {
      console.error('Error processing notifications:', error);
      return { sent: 0, failed: 0, error: error.message };
    }
  }
};