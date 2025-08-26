const { Client, GatewayIntentBits } = require('discord.js');
const db = require('../database/db');

const discordBot = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers // Add this intent
    ]
});

// Bot configuration
let botConfig = {
    enabled: false,
    botToken: process.env.DISCORD_BOT_TOKEN,
    defaultMessage: 'Your application has been reviewed!'
};

// Initialize bot if token is available
if (botConfig.botToken) {
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
    });
} else {
    console.log('Discord bot token not configured. Notifications will be disabled.');
}

// Function to send application notification
async function sendApplicationNotification(application, customMessage = null) {
    if (!botConfig.enabled || !botConfig.botToken) {
        console.log('Discord bot not configured or enabled');
        return false;
    }

    try {
        // Get user's Discord ID
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT discord_id FROM users WHERE id = ?', [application.user_id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

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
            
            const message = customMessage || botConfig.defaultMessage;

            const embed = {
                color: statusColor,
                title: `${statusEmoji} Update - ${application.form_title}`,
                fields: [
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
                ],
                description: message,
                timestamp: new Date(),
                footer: {
                    text: 'Skyrden Recruitment'
                }
            };

            if (application.admin_feedback) {
                embed.fields.push({
                    name: 'Feedback',
                    value: application.admin_feedback.substring(0, 1000) + (application.admin_feedback.length > 1000 ? '...' : ''),
                    inline: false
                });
            }

            await discordUser.send({ embeds: [embed] });
            
            // Update notification status in database
            db.run(
                'UPDATE application_responses SET notification_sent = 1, notification_sent_at = CURRENT_TIMESTAMP WHERE id = ?',
                [application.id]
            );

            console.log(`✅ Notification sent to user ${user.discord_id} for application ${application.id}`);
            return true;

        } catch (dmError) {
            console.error('Failed to send DM to user:', dmError);
            return false;
        }

    } catch (error) {
        console.error('Failed to send Discord notification:', error);
        return false;
    }
}

// Function to send all pending notifications
async function sendAllPendingNotifications() {
    if (!botConfig.enabled) {
        console.log('Discord bot not enabled');
        return { success: 0, failed: 0 };
    }

    try {
        const pendingApplications = await new Promise((resolve, reject) => {
            db.all(`
                SELECT ar.*, af.title as form_title, u.discord_id 
                FROM application_responses ar
                JOIN application_forms af ON ar.application_form_id = af.id
                JOIN users u ON ar.user_id = u.id
                WHERE ar.status IN ('approved', 'rejected') 
                AND ar.notification_sent = 0
                AND ar.admin_feedback IS NOT NULL
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        let successCount = 0;
        let failedCount = 0;

        for (const app of pendingApplications) {
            const success = await sendApplicationNotification(app);
            if (success) {
                successCount++;
            } else {
                failedCount++;
            }
            // Add small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return { success: successCount, failed: failedCount };
    } catch (error) {
        console.error('Error sending pending notifications:', error);
        return { success: 0, failed: 0 };
    }
}

// Update bot configuration
function updateBotConfig(newConfig) {
    botConfig = { ...botConfig, ...newConfig };
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down Discord bot...');
    if (discordBot && discordBot.destroy) {
        discordBot.destroy();
    }
    process.exit(0);
});

module.exports = {
    discordBot,
    sendApplicationNotification,
    sendAllPendingNotifications,
    updateBotConfig,
    getBotConfig: () => botConfig
};