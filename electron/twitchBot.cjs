// Twitch IRC Chatbot — Song Request, Skip, Voteskip
// Pattern follows obsServer.cjs: module exports connect/disconnect + event callback

const tmi = require('tmi.js')

let client = null
let eventCallback = null
let config = {}
let voteskipUsers = new Set()
const recentSrUrls = new Map() // url → timestamp (60s cooldown)

function setEventCallback(cb) {
  eventCallback = cb
}

function emit(type, data) {
  if (eventCallback) eventCallback(type, data)
}

async function connect(cfg) {
  config = cfg
  if (client) {
    try { client.disconnect() } catch {}
    client = null
  }

  const opts = {
    connection: { reconnect: true, secure: true },
    channels: [cfg.channel],
  }

  // If OAuth token provided, use it for authenticated bot (can send messages)
  if (cfg.oauthToken && cfg.botUsername) {
    opts.identity = {
      username: cfg.botUsername,
      password: cfg.oauthToken.startsWith('oauth:') ? cfg.oauthToken : `oauth:${cfg.oauthToken}`,
    }
  }

  client = new tmi.Client(opts)

  client.on('connected', () => {
    emit('connected', { channel: cfg.channel })
  })

  client.on('disconnected', (reason) => {
    emit('disconnected', { reason })
  })

  client.on('message', (channel, tags, message, self) => {
    if (self) return
    handleMessage(channel, tags, message)
  })

  await client.connect()
}

function handleMessage(channel, tags, message) {
  const msg = message.trim()
  const isMod = tags.mod || (tags.badges && tags.badges.broadcaster === '1')
  const username = tags['display-name'] || tags.username || 'anonymous'
  const userId = tags['user-id'] || username

  // !sr <URL> - Song Request
  if (msg.startsWith('!sr ') && config.songRequestEnabled !== false) {
    const url = msg.slice(4).trim()
    if (!url) return

    // Dedupe: ignore same URL within 60 seconds
    const now = Date.now()
    const lastReq = recentSrUrls.get(url)
    if (lastReq && now - lastReq < 60000) {
      emit('sr-duplicate', { url, username })
      return
    }
    recentSrUrls.set(url, now)
    // Clean old entries
    for (const [k, v] of recentSrUrls) {
      if (now - v > 60000) recentSrUrls.delete(k)
    }

    emit('song-request', { url, username })
    return
  }

  // !skip - Mod/Broadcaster only
  if (msg === '!skip' && config.modSkipEnabled !== false) {
    if (isMod) {
      emit('skip', { username })
    }
    return
  }

  // !song - Show current song
  if (msg === '!song') {
    emit('song-query', { username })
    return
  }

  // !voteskip - Any user, tracked by user ID
  if (msg === '!voteskip') {
    voteskipUsers.add(userId)
    const threshold = config.voteskipThreshold || 3
    const current = voteskipUsers.size
    emit('voteskip-vote', { username, current, threshold })
    if (current >= threshold) {
      emit('voteskip-reached', { count: current })
      voteskipUsers.clear()
    }
    return
  }
}

async function disconnect() {
  if (client) {
    try { await client.disconnect() } catch {}
    client = null
  }
  voteskipUsers.clear()
  emit('disconnected', { reason: 'manual' })
}

function say(message) {
  if (client && config.channel) {
    client.say(config.channel, message).catch(() => {})
  }
}

function resetVoteskip() {
  voteskipUsers.clear()
}

function updateConfig(cfg) {
  config = { ...config, ...cfg }
}

module.exports = { connect, disconnect, setEventCallback, say, resetVoteskip, updateConfig }
