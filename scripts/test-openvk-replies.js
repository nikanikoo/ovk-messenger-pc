'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const root = path.resolve(__dirname, '..')
const window = { lang: {
  im_reply: 'Reply', message: 'Message', im_attach_photo: 'Photo',
  viewer_go_to_message: 'Go to message', im_remove_attachment: 'Remove attachment'
} }
const context = { window, module: { exports: {} } }
for (const name of ['openvk-api-compat', 'openvk-replies']) {
  vm.runInNewContext(fs.readFileSync(path.join(root, 'app/app/lib/' + name + '.js'), 'utf8'), context)
}

// Capture the real recovered model without starting Electron or signing in.
const bundle = fs.readFileSync(path.join(root, 'app/dist/main.js'), 'utf8')
vm.runInNewContext(bundle.replace('t(t.s = 959)', 't'), context)
const modules = context.module.exports.m
const cache = {}
class Attachment {
  setData(raw) { this.type = raw.type; this.data = raw[raw.type]; return this }
  getType() { return this.type }
  getBySize() { return this.data.sizes[0] }
}
function loadModel(id) {
  if (cache[id]) return cache[id].exports
  if (id === 107) return () => 123
  if (id !== 84 && id !== 323) return Attachment
  const module = cache[id] = { exports: {} }
  modules[id](module, module.exports, loadModel)
  return module.exports
}
const Message = loadModel(84).default
const compat = window.OpenVKCompat
const replies = window.OpenVKReplies
const rawReply = { id: 10, peer_id: 7, from_id: 7, date: 1, text: 'Original message' }
const rawForward = { from_id: 8, date: 2, text: 'Real forward' }
const makeReply = () => Message.FromRawMessage({
  id: 11, peer_id: 7, from_id: 9, date: 3, text: 'My answer',
  reply_to: 10, reply_message: rawReply, fwd_messages: [rawForward]
})
const message = makeReply()
assert.ok(message.replyMessage instanceof Message)
assert.strictEqual(message.replyMessage.text, rawReply.text)
assert.strictEqual(message.fwdMessages.length, 1)
assert.strictEqual(message.fwdMessages[0].text, rawForward.text)
compat.applyReply(message, null, Message)
compat.applyReply(message, null, Message)
assert.strictEqual(message.fwdMessages.length, 1, 'Reply normalization must not add forwards')

const serverCopy = Message.FromRawMessage({ id: 11, peer_id: 7, text: 'My answer' })
compat.inheritReply(serverCopy, message)
assert.strictEqual(serverCopy.replyMessage, message.replyMessage)
assert.strictEqual(serverCopy.replyTo, 10)
assert.strictEqual(serverCopy.fwdMessages.length, 0)
const otherReply = { replyTo: 20 }
compat.inheritReply(otherReply, message)
assert.ok(!otherReply.replyMessage, 'Do not inherit a preview for a different reply ID')
const optimistic = Message.FromRawMessage({ id: 0, peer_id: 7, text: 'Sending' })
optimistic.replyTo = 10
optimistic.replyMessage = Message.FromRawMessage(rawReply)
compat.applyReply(optimistic, null, Message)
assert.strictEqual(optimistic.fwdMessages.length, 0)

const React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }) }
const navigations = []
const runtime = {
  getUser: id => ({ getName: () => 'User ' + id }),
  getGroup: id => ({ name: 'Group ' + id }),
  getMessage: (groupId, peerId, id) => id === 10 ? message.replyMessage : null,
  getText: item => ({ text: item.text || 'Photo', isServiceMessage: !item.text }),
  formatText: text => text,
  toMessage: (...args) => navigations.push(args)
}
replies.configure(runtime)
function find(node, className) {
  if (!node || typeof node !== 'object') return null
  if ((node.props.className || '').split(' ').includes(className)) return node
  for (const child of node.children) {
    const result = find(child, className)
    if (result) return result
  }
  return null
}
function event(key) {
  return { key, prevented: false, stopped: false,
    preventDefault() { this.prevented = true }, stopPropagation() { this.stopped = true } }
}
const card = replies.render(React, message, 0, 7)
assert.strictEqual(find(card, 'im_message_reply_title').children[0], 'User 7')
assert.strictEqual(find(card, 'im_message_reply_text').children[0], 'Original message')
assert.strictEqual(find(card, 'im_fwd_message'), null)
const click = event()
card.props.onClick(click)
assert.ok(click.prevented && click.stopped)
card.props.onKeyDown(event('Enter'))
card.props.onKeyDown(event(' '))
card.props.onKeyDown(event('Escape'))
assert.deepStrictEqual(navigations, [[0, 7, 10], [0, 7, 10], [0, 7, 10]])
assert.strictEqual(replies.render(React, { text: 'No reply' }, 0, 7), null)
const absent = replies.render(React, { replyTo: 99 }, 0, 7)
assert.strictEqual(find(absent, 'im_message_reply_text').children[0], 'Message')
const outgoing = makeReply()
outgoing.replyMessage.out = true
assert.strictEqual(find(replies.render(React, outgoing, 42, 7), 'im_message_reply_title').children[0], 'Group 42')

const photo = Message.FromRawMessage({ ...rawReply, text: '', attachments: [{ type: 'photo', photo: {
  sizes: [{ type: 'm', url: 'https://example.invalid/photo.jpg', width: 130, height: 130 }]
} }] })
const photoCard = replies.render(React, { replyTo: 10, replyMessage: photo }, 0, 7)
assert.strictEqual(find(photoCard, 'im_message_reply_img').props.src, 'https://example.invalid/photo.jpg')
assert.ok(find(photoCard, 'im_message_reply_text').props.className.includes('-attaches'))

let removed = 0
const draft = replies.renderDraft(React, 0, 7, 10, () => { removed++ })
assert.strictEqual(find(draft, 'im_message_reply_title').children[0], 'User 7')
assert.strictEqual(draft.props.onClick, undefined)
const removeClick = event()
find(draft, 'openvk-reply-remove').props.onClick(removeClick)
assert.strictEqual(removed, 1)
assert.ok(removeClick.prevented && removeClick.stopped)

// All message layouts must render the quote before their own text/attachments.
const layouts = modules.filter(factory => factory && /OpenVKReplies\.render\(/.test(factory.toString()))
assert.strictEqual(layouts.length, 3, 'Full, consecutive and gift messages need a reply renderer')
for (const factory of layouts) {
  assert.match(factory.toString(), /:\s*\[window\.OpenVKReplies\.render\(/)
}
assert.ok(!bundle.includes('OpenVKCompat.renderReply'))
assert.match(fs.readFileSync(path.join(root, 'app/app/window.html'), 'utf8'), /lib\/openvk-replies\.js/)

async function hydration() {
  const calls = []
  const api = (method, params) => {
    calls.push({ method, params })
    const data = method === 'messages.getHistory'
      ? { items: [{ id: 11, peer_id: 7, text: 'Answer', reply_to: 10 }] }
      : { items: [rawReply], profiles: [{ id: 7 }], groups: [] }
    return { promise: Promise.resolve(data) }
  }
  const history = await compat.wrapApi(api)('messages.getHistory', { peer_id: 7 })
  const hydrated = Message.FromRawMessage(history.items[0])
  assert.strictEqual(hydrated.replyMessage.text, rawReply.text)
  assert.strictEqual(hydrated.fwdMessages.length, 0)
  assert.strictEqual(history.profiles[0].id, 7)
  assert.strictEqual(calls[1].params.message_ids, '10')
  console.log('OpenVK replies: model, hydration, rendering, navigation and composer OK')
}
hydration().catch(error => { console.error(error); process.exitCode = 1 })
