const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const ApplicationResponse = require('../models/ApplicationResponse');

// Create a singleton for bot configuration
let botConfig = {
  enabled: false,
  botToken: process.env.DISCORD_BOT_TOKEN,
  defaultMessage: 'Your application has been reviewed!'
};

// Create Discord client
const discordBot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers
  ]
});

// Initialize bot if token is available
function initializeBot() {
  if (!botConfig.botToken) {
    console.log('Discord bot token not configured. Notifications will be disabled.');
    botConfig.enabled = false;
    return false;
  }
  
  discordBot.login(botConfig.botToken).then(() => {
    console.log('Discord bot logged in successfully');
    botConfig.enabled = true;
    
    // Bot ready event
    discordBot.on('ready', () => {
      console.log(`✅ Discord bot logged in as ${discordBot.user.tag}`);
      console.log(`✅ Bot is in ${discordBot.guilds.cache.size} servers`);
    });
    
    // Bot error handling
    discordBot.on('error', (error) => {
      console.error('Discord bot error:', error);
    });
    
  }).catch(err => {
    console.error('Failed to login Discord bot:', err);
    botConfig.enabled = false;
    return false;
  });
  
  return true;
}

// Initialize bot on startup if token exists
if (process.env.DISCORD_BOT_TOKEN) {
  initializeBot();
}

// Function to send application notification
async function sendApplicationNotification(application, customMessage = null) {
  if (!botConfig.enabled || !botConfig.botToken) {
    console.log('Discord bot not configured or enabled');
    return false;
  }

  try {
    // Get user from database
    const user = await User.findById(application.user_id);
    
    if (!user || !user.discord_id) {
      console.log('User not found or no Discord ID');
      return false;
    }

    // Try to send DM to user
    try {
      const discordUser = await discordBot.users.fetch(user.discord_id);
      if (!discordUser) {
        console.log('Discord user not found');
        return false;
      }

      const statusColor = application.status === 'approved' ? 0x00FF00 : 0xFF0000;
      const statusEmoji = application.status === 'approved' ? '✅' : '❌';
      
      const message = customMessage || botConfig.defaultMessage;

      const embed = new EmbedBuilder()
        .setColor(statusColor)
        .setTitle(`${statusEmoji} Update - ${application.form_title}`)
        .addFields([
          {
            name: 'Status',
            value: application.status.toUpperCase(),
            inline: true
          },
          {
            name: 'Submitted',
            value: new Date(application.created_at).toLocaleDateString(),
            inline: true
          }
        ])
        .setDescription(message)
        .setTimestamp()
        .setFooter({ text: 'Skyrden Recruitment' });

      if (application.admin_feedback) {
        embed.addFields([
          {
            name: 'Feedback',
            value: application.admin_feedback.substring(0, 1000) + (application.admin_feedback.length > 1000 ? '...' : ''),
            inline: false
          }
        ]);
      }

      await discordUser.send({ embeds: [embed] });
      
      // Update notification status in database
      await ApplicationResponse.findByIdAndUpdate(application.id, {
        notification_sent: true,
        notification_sent_at: new Date()
      });
      
      console.log(`Notification sent to user ${user.discord_username} for application ${application.id}`);
      return true;
    } catch (error) {
      console.error('Error sending Discord notification:', error);
      return false;
    }
  } catch (error) {
    console.error('Error in notification process:', error);
    return false;
  }
}

// Function to send all pending notifications
async function sendAllPendingNotifications() {
  if (!botConfig.enabled || !botConfig.botToken) {
    return { success: 0, failed: 0, error: 'Bot not configured' };
  }

  try {
    // Find all applications that need notifications
    const pendingNotifications = await ApplicationResponse.find({
      status: { $in: ['approved', 'rejected'] },
      notification_sent: false,
      reviewed_at: { $exists: true }
    }).populate('application_form_id', 'title');
    
    console.log(`Found ${pendingNotifications.length} pending notifications`);
    
    let success = 0;
    let failed = 0;
    
    // Process each notification
    for (const app of pendingNotifications) {
      try {
        const notificationData = {
          id: app._id,
          user_id: app.user_id,
          form_title: app.application_form_id ? app.application_form_id.title : 'Application',
          status: app.status,
          admin_feedback: app.admin_feedback,
          created_at: app.created_at
        };
        
        const sent = await sendApplicationNotification(notificationData);
        if (sent) {
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Error sending notification for application ${app._id}:`, error);
        failed++;
      }
    }
    
    return { success, failed };
  } catch (error) {
    console.error('Error processing pending notifications:', error);
    return { success: 0, failed: 0, error: error.message };
  }
}

// Function to update bot configuration
async function updateBotConfig(newConfig) {
  try {
    // Update the configuration
    botConfig = {
      ...botConfig,
      ...newConfig
    };
    
    // If bot token changed, reinitialize
    if (newConfig.botToken && newConfig.botToken !== process.env.DISCORD_BOT_TOKEN) {
      // Logout existing bot if necessary
      if (discordBot.isReady()) {
        await discordBot.destroy();
      }
      
      // Initialize with new token
      return initializeBot();
    }
    
    return true;
  } catch (error) {
    console.error('Error updating bot config:', error);
    return false;
  }
}

// Function to get current bot configuration
function getBotConfig() {
  // Return a sanitized version (don't include the full token)
  return {
    enabled: botConfig.enabled,
    hasToken: !!botConfig.botToken,
    defaultMessage: botConfig.defaultMessage
  };
}

module.exports = {
  sendApplicationNotification,
  sendAllPendingNotifications,
  updateBotConfig,
  getBotConfig
};