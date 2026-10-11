'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const storage = new Map()
const window = { localStorage: {
  getItem: key => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, value)
} }
const source = fs.readFileSync(path.join(__dirname, '../app/app/lib/openvk-api-compat.js'), 'utf8')
vm.runInNewContext(source, { window, console })

async function main() {
  const calls = []
  const api = (method, params, options) => {
    calls.push({ method, params })
    let value = 1
    if (method === 'groups.get') value = { count: 1, items: [{ id: 7, is_admin: 1, can_message: true, deactivated: null }] }
    if (method === 'groups.getBanned') {
      value = params.offset === 0 && params.count === 200
        ? { count: 201, items: Array.from({ length: 200 }, (_, i) => ({ id: i + 1 })) }
        : { count: 201, items: [{ id: 201 }] }
    }
    if (method === 'messages.getConversations') value = {
      count: 2, unread_count: 0, items: [
        { conversation: { peer: { id: 40001, type: 'community' } }, last_message: { id: 1 } },
        { conversation: { peer: { id: -42, type: 'community' } }, last_message: { id: 2 } }
      ]
    }
    if (method === 'messages.getConversations' && params.group_id === 99) value = {
      count: 201, unread_count: 3,
      items: params.offset ? [{ conversation: { unanswered: true } }] :
        Array.from({ length: 200 }, (_, i) => ({ conversation: {
          important: i === 0, unanswered: i === 1
        } }))
    }
    if (method === 'messages.getConversationsById') value = {
      count: 1, items: [{ peer: { id: 40001, type: 'community' } }]
    }
    if (method === 'messages.getHistory') value = {
      count: 0, unread: 0, items: [], conversations: []
    }
    if (method === 'messages.getLongPollHistory') value = {
      history: [[4, 100, 0, 40001]],
      messages: { count: 1, items: [{ id: 100, peer_id: 40001 }] },
      new_pts: 5
    }
    if (method === 'messages.getByConversationMessageId') value = {
      count: 1, items: [{ id: 100, peer_id: 40001, conversation_message_id: 3 }]
    }
    const child = { promise: Promise.resolve(value), abortSilently() {}, abort() {} }
    return options && options.returnRequest ? child : child.promise
  }
  const request = window.OpenVKCompat.wrapApi(api)

  const updates = [[4, 100, 1, 40001, 123, '', 'hello', { from: 40001, cmid: 3 }, { minor_id: 3 }]]
  window.OpenVKCompat.normalizeLongPoll(updates)
  assert.strictEqual(updates[0][5], 'hello')
  assert.strictEqual(updates[0][6].cmid, 3)

  const groups = await request('groups.get', { filter: 'editor' })
  assert.strictEqual(calls.pop().params.filter, 'admin')
  assert.strictEqual(groups.items[0].deactivated, undefined)
  assert.strictEqual(groups.items[0].can_message, true)

  await request('account.banUser', { user_id: 5 })
  assert.deepStrictEqual(JSON.parse(JSON.stringify(calls.pop())), { method: 'account.ban', params: { owner_id: 5 } })
  await request('account.unbanUser', { user_id: 5 })
  assert.deepStrictEqual(JSON.parse(JSON.stringify(calls.pop())), { method: 'account.unban', params: { owner_id: 5 } })

  await request('groups.banUser', { group_id: 7, user_id: 5, reason: 0 })
  const ban = calls.pop()
  assert.strictEqual(ban.method, 'groups.ban')
  assert.strictEqual(ban.params.owner_id, 5)
  await request('groups.unbanUser', { group_id: 7, user_id: 5 })
  assert.deepStrictEqual(JSON.parse(JSON.stringify(calls.pop())), { method: 'groups.unban', params: { group_id: 7, owner_id: 5 } })

  const status = await request('groups.getBanned', { group_id: 7, user_id: 201 })
  assert.strictEqual(status.count, 1)
  assert.strictEqual(status.items[0].id, 201)
  assert.strictEqual(calls.pop().params.offset, 200)
  const absent = await request('groups.getBanned', { group_id: 7, user_id: 202 })
  assert.strictEqual(absent.count, 0)

  const list = await request('groups.getBanned', { group_id: 7, offset: 0, count: 200 })
  assert.strictEqual(list.items[0].type, 'profile')
  assert.strictEqual(list.items[0].profile.id, 1)
  assert.ok(list.items[0].ban_info)

  const dialogs = await request('openvk.getDialogsAndLP', { group_id: 7, filter: 'all', count: 20 })
  assert.strictEqual(dialogs.conversations.items[0].conversation.peer.type, 'user')
  assert.strictEqual(dialogs.conversations.items[1].conversation.peer.type, 'group')
  assert.strictEqual(calls.find(call => call.method === 'messages.getConversations').params.group_id, 7)
  const direct = await request('messages.getConversationsById', { group_id: 7, peer_ids: 40001 })
  assert.strictEqual(direct.items[0].peer.type, 'user')
  const emptyHistory = await request('messages.getHistory', { user_id: 18393, extended: 1 })
  assert.strictEqual(emptyHistory.conversations[0].in_read, 0)
  assert.strictEqual(emptyHistory.conversations[0].out_read, 0)
  assert.strictEqual(emptyHistory.conversations[0].last_message_id, 0)
  const chat = await request('openvk.getChat', { group_id: 7, peer_id: 40001 })
  assert.strictEqual(chat.conversation.peer.type, 'user')
  const history = await request('messages.getLongPollHistory', { group_id: 7, ts: 1, pts: 1 })
  assert.strictEqual(history.conversations[0].peer.type, 'user')
  assert.strictEqual(calls.find(call => call.method === 'messages.getConversationsById' && call.params.group_id === 7).params.group_id, 7)
  const groupMessage = await request('messages.getByConversationMessageId', {
    group_id: 7, peer_id: 40001, conversation_message_ids: 3
  })
  assert.strictEqual(groupMessage.items[0].id, 100)

  const counters = await request('messages.getGroupsCounters', { group_ids: 99 }, { returnRequest: true }).promise
  assert.deepStrictEqual(JSON.parse(JSON.stringify(counters)), [{
    unread_dialogs: 3, important_dialogs: 1, unanswered_dialogs: 2
  }])
  assert.strictEqual(calls.filter(call => call.method === 'messages.getConversations' && call.params.group_id === 99).length, 2)

  const templateId = await request('messages.addTemplate', { group_id: 7, name: 'Ответ', text: 'Привет' })
  assert.strictEqual((await request('messages.getTemplates', { group_id: 7 })).items[0].name, 'Ответ')
  assert.strictEqual((await request('messages.getTemplates', { group_id: 8 })).count, 0)
  await request('messages.editTemplate', { group_id: 7, template_id: templateId, name: 'Ответ 2', text: 'Здравствуйте' })
  assert.strictEqual((await request('messages.getTemplates', { group_id: 7 })).items[0].text, 'Здравствуйте')
  await request('messages.deleteTemplate', { group_id: 7, template_id: templateId })
  assert.strictEqual((await request('messages.getTemplates', { group_id: 7 })).count, 0)

  const pending = request('account.banUser', { user_id: 5 }, { returnRequest: true })
  assert.strictEqual(await pending.promise, 1)
  assert.strictEqual(typeof pending.abortSilently, 'function')
  console.log('OpenVK API compatibility: OK')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
