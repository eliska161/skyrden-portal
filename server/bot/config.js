// Discord Bot Configuration
module.exports = {
  // Bot configuration
  prefix: '!',  // Command prefix
  
  // Discord server (guild) settings
  guildId: process.env.DISCORD_GUILD_ID || '',
  
  // Channel IDs
  channels: {
    applications: process.env.DISCORD_APPLICATIONS_CHANNEL || '',
    notifications: process.env.DISCORD_NOTIFICATIONS_CHANNEL || '',
    logs: process.env.DISCORD_LOGS_CHANNEL || ''
  },
  
  // Role IDs
  roles: {
    admin: process.env.DISCORD_ADMIN_ROLE || '',
    moderator: process.env.DISCORD_MODERATOR_ROLE || '',
    member: process.env.DISCORD_MEMBER_ROLE || ''
  },
  
  // Message templates
  messages: {
    applicationReceived: 'New application received from {username}!',
    applicationApproved: 'Your application has been approved! Welcome to Skyrden.',
    applicationRejected: 'Your application was not approved at this time.'
  },
  
  // Other settings
  embedColor: '#5865F2'  // Discord blue color for embeds
};