require('dotenv').config()
const Discord = require('discord.js');
const config = require('../config.js');
const stripIndent = require('strip-indent');

class Bot extends Discord.Client {
  constructor(config) {
    super();
    Object.assign(this, config);
    this.replying = {};
    this.rawEvents = {
      MESSAGE_REACTION_ADD: 'messageReactionAdd',
      MESSAGE_REACTION_REMOVE: 'messageReactionRemove',
    };
    this.init();
  }

  ready() {
    console.log(`Logged in as ${this.user.tag}!`);
    this.user.setActivity(`for ${this.emoji} reactions`, { type: 3 });
  }

  init() {
    this.login(process.env.TOKEN);
    this.on('message', this.message);
    this.on('messageReactionAdd', this.messageReactionAdd);
    this.on('messageReactionRemove', this.messageReactionRemove);
    this.on('raw', this.raw);
    this.on('ready', this.ready);
    this.on('rateLimit', this.rateLimit);
  }
  
  async raw(event) {
    if (!this.rawEvents.hasOwnProperty(event.t)) return;

    const { d: data } = event;
    const user = this.users.get(data.user_id);
    const channel = this.channels.get(data.channel_id);

    if (channel.messages.has(data.message_id)) return;

    const message = await channel.fetchMessage(data.message_id);
    const emojiKey = (data.emoji.id) ? `${data.emoji.name}:${data.emoji.id}` : data.emoji.name;
    let reaction = message.reactions.get(emojiKey);

    if (!reaction) {
      const emoji = new Discord.Emoji(this.guilds.get(data.guild_id), data.emoji);
      reaction = new Discord.MessageReaction(message, emoji, 1, data.user_id === this.user.id);
      // See https://github.com/discordjs/guide/pull/165
      message._addReaction(emoji, user);
    }

    this.emit(this.rawEvents[event.t], reaction, user);
  }

  async message(msg) {
    if (msg.author.bot) return;
    if (msg.channel.type !== 'text') return;
    if (!this.replying.hasOwnProperty(msg.author.id)) return;

    const pastMsg = this.replying[msg.author.id];
    if (pastMsg.channel !== msg.channel) return;

    const embed = new Discord.RichEmbed();
    embed.setColor(0x36393f);
    embed.setAuthor(`${msg.member.displayName} | ${msg.author.id}`, msg.author.displayAvatarURL)

    let pastMember = pastMsg.member;
    let pastEmbededMsg = pastMsg.content;

    if (pastMsg.author.id === this.user.id) {
      pastMember = await this.fetchUser(pastMsg.embeds[0].author.name.match(/(?<=\| )\d+/)[0]);
      pastEmbededMsg = pastMsg.embeds[0].description.match(/(.|\n)+(?=\n\n\*\*Original Message:\*\*)/)[0];
    }

    embed.setDescription(stripIndent(`
      ${msg.content}
      
      **Original Message:**
      [${pastEmbededMsg.slice(0, 50)}...](${pastMsg.url})
    `));

    msg.delete();
    msg.channel.send(pastMember, embed);
    delete this.replying[msg.author.id];
  }

  messageReactionAdd(rxn, user) {
    if (user.bot) return;
    if (rxn.emoji.name !== this.emoji) return;

    this.replying[user.id] = rxn.message;
  }

  messageReactionRemove(rxn, user) {
    if (user.bot) return;
    if (rxn.emoji.name !== this.emoji) return;
    if (!this.replying.hasOwnProperty(user.id)) return;

    delete this.replying[user.id];
  }

  rateLimit(info) {
    console.log(`The bot is being rate limited.`);
    console.log(info);
  }
}

new Bot(config);

process.on('unhandledRejection', (r, p) => { console.error('Unhandled Rejection at:', p) });
