"""Patch the recovered, minified VK 3.9.0 renderer to support real replies.

The original client implements its Reply button through forwarding. Keep the
patch as exact, checked replacements so it can be reapplied to a fresh bundle.
"""

from pathlib import Path


bundle = Path(__file__).resolve().parents[1] / "app" / "dist" / "main.js"
source = bundle.read_text(encoding="utf-8")


def replace_once(old: str, new: str) -> None:
    global source
    if source.count(new) == 1 and source.count(old) == 0:
        return
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one occurrence, found {count}: {old[:90]}")
    source = source.replace(old, new, 1)


def upgrade_once(old: str, new: str) -> None:
    """Apply a later fix to both newly recovered and previously patched bundles."""
    replace_once(old, new)


def upgrade_many(old: str, new: str, expected: int) -> None:
    global source
    if source.count(new) == expected and source.count(old) == 0:
        return
    if source.count(old) != expected:
        raise RuntimeError(f"Expected {expected} occurrences, found {source.count(old)}: {old[:90]}")
    source = source.replace(old, new)


# The two Reply buttons: per-message and selected-message toolbar.
replace_once(
    "p.default.forwardSelectedMessages(n.props.groupId,t,n.props.groupId,t,[o])",
    "p.default.forwardSelectedMessages(n.props.groupId,t,n.props.groupId,t,[o],!0)",
)
replace_once(
    "Ie.default.forwardSelectedMessages(e.state.groupId,e.state.id,e.state.groupId,e.state.id)}",
    "Ie.default.forwardSelectedMessages(e.state.groupId,e.state.id,e.state.groupId,e.state.id,null,!0)}",
)

# Carry the Reply intent through the existing draft event without changing
# actual Forward actions.
replace_once(
    'key:"forwardSelectedMessages",value:function(e,t,n,o,r){var i=$.default.getDialogData(e,t);r||(r=i.selected),"compose"==o&&(o=h.default.COMPOSE_DIALOG_ID),(0,E.dispatch)("im_forward_messages",{srcGroupId:e,srcPeerId:t,dstGroupId:n,dstPeerId:o,ids:r})',
    'key:"forwardSelectedMessages",value:function(e,t,n,o,r,i){var a=$.default.getDialogData(e,t);r||(r=a.selected),"compose"==o&&(o=h.default.COMPOSE_DIALOG_ID),(0,E.dispatch)("im_forward_messages",{srcGroupId:e,srcPeerId:t,dstGroupId:n,dstPeerId:o,ids:r,isReply:!!i})',
)
replace_once(
    "s.draftMessage.draftSetMessagesToForward(n,o,a),u.unselectMessages(a)",
    "s.draftMessage.draftSetMessagesToForward(n,o,a),s.draftMessage.draftReplyTo=t.isReply&&a.length===1&&n===r&&o===i?a[0]:null,u.unselectMessages(a)",
)
replace_once(
    'key:"draftUnsetMessagesToForward",value:function(){this.draftFwd=[],this.draftFwdSrcPeerId=null,this.draftFwdSrcGroupId=null}',
    'key:"draftUnsetMessagesToForward",value:function(){this.draftFwd=[],this.draftFwdSrcPeerId=null,this.draftFwdSrcGroupId=null,this.draftReplyTo=null}',
)

# The message queue must send reply_to instead of forward_messages. The draft
# still reuses the old attachment preview, but the sent message is a reply.
replace_once(
    'e.draftFwd&&e.draftFwd.length&&(this.groupId!=e.draftFwdSrcGroupId?o.group_forward_messages=e.draftFwd.map(function(t){return"-"+e.draftFwdSrcGroupId+"_"+t}).join(","):o.forward_messages=e.draftFwd.join(","))',
    'e.draftReplyTo?o.reply_to=e.draftReplyTo:e.draftFwd&&e.draftFwd.length&&(this.groupId!=e.draftFwdSrcGroupId?o.group_forward_messages=e.draftFwd.map(function(t){return"-"+e.draftFwdSrcGroupId+"_"+t}).join(","):o.forward_messages=e.draftFwd.join(","))',
)
replace_once(
    '_.setRawData(w,b),r&&i&&_.attachments[0].setStickerReferrer(i)',
    '_.setRawData(w,b),n.draftReplyTo&&(_.draftReplyTo=n.draftReplyTo,_.replyTo=n.draftReplyTo,_.replyMessage=u.messages[n.draftReplyTo]||null,window.OpenVKCompat.applyReply(_,null)),r&&i&&_.attachments[0].setStickerReferrer(i)',
)
replace_once(
    'm!=l.length-1||r||_.draftHasMessagesToForward()&&function(){',
    'm!=l.length-1||r||!n.draftReplyTo&&_.draftHasMessagesToForward()&&function(){',
)
replace_once(
    'delete this.draftFwdSrcPeerId,delete this.draftFwdSrcGroupId}',
    'delete this.draftFwdSrcPeerId,delete this.draftFwdSrcGroupId,delete this.draftReplyTo}',
)

# Store API reply fields on the recovered message model. Both history and
# long-poll hydration call setRawData; last-message previews use the other path.
replace_once(
    'this.id=t.id,this.guid=n,this.text=t.text||"",this.peerId=t.peer_id',
    'this.id=t.id,this.guid=n,this.text=t.text||"",this.replyTo=t.reply_to||this.draftReplyTo||this.replyTo||null,this.replyMessage=t.reply_message||this.replyMessage||null,this.peerId=t.peer_id',
)
replace_once(
    'this.id=t.id,this.time=t.date,this.peerId=t.peer_id,this.fromId=t.from_id,this.text=t.text||"",this.out=t.out||!1',
    'this.id=t.id,this.time=t.date,this.peerId=t.peer_id,this.fromId=t.from_id,this.text=t.text||"",this.replyTo=t.reply_to||this.replyTo||null,this.replyMessage=t.reply_message||this.replyMessage||null,this.out=t.out||!1',
)

# Render a dedicated reply block above message text in both message layouts.
replace_once(
    'R=t.isDeleted()?c.default.createElement(C.default,{peerId:a,groupId:i,messageId:f}):[c.default.createElement(v.default,{key:"mt"',
    'R=t.isDeleted()?c.default.createElement(C.default,{peerId:a,groupId:i,messageId:f}):[window.OpenVKCompat.renderReply(c.default,t),c.default.createElement(v.default,{key:"mt"',
)
replace_once(
    'C=t.isDeleted()?c.default.createElement(D.default,{peerId:i,groupId:r,messageId:l}):[c.default.createElement(h.default,{key:"at"',
    'C=t.isDeleted()?c.default.createElement(D.default,{peerId:i,groupId:r,messageId:l}):[window.OpenVKCompat.renderReply(c.default,t,!0),c.default.createElement(h.default,{key:"at"',
)

# The composer also used the forward attachment preview for Reply. Give it a
# separate preview so the user can see which action will be sent.
replace_once(
    'fwd:this.props.fwd,attaches:this.props.attaches,fwdSrcGroupId:',
    'fwd:this.props.fwd,replyTo:this.props.replyTo,attaches:this.props.attaches,fwdSrcGroupId:',
)
replace_once(
    'fwd:n.draftGetMessagesToForward(),fwdSrcGroupId:',
    'fwd:n.draftGetMessagesToForward(),replyTo:n.draftReplyTo,fwdSrcGroupId:',
)
# Keep the client's normal forwarded-message preview, with a reply caption.
preview_original = 't.push(b.default.createElement(N.default,{isLast:!0,key:"fwd"},b.default.createElement(E.default,_({groupId:this.props.groupId},l))))'
preview_previous = 't.push(b.default.createElement(N.default,{isLast:!0,key:"fwd"},this.props.replyTo?b.default.createElement("div",{className:"openvk-draft-reply"},b.default.createElement("span",null,"Ответ на сообщение #"+this.props.replyTo),b.default.createElement("button",{type:"button",onClick:l.onRemoveClick},"×")):b.default.createElement(E.default,_({groupId:this.props.groupId},l))))'
preview_final = 't.push(b.default.createElement(N.default,{isLast:!0,key:"fwd"},this.props.replyTo?b.default.createElement("div",{className:"openvk-draft-reply"},b.default.createElement("div",{className:"im_fwd_messages_title"},"В ответ на сообщение"),b.default.createElement(E.default,_({groupId:this.props.groupId},l))):b.default.createElement(E.default,_({groupId:this.props.groupId},l))))'
if source.count(preview_final) != 1:
    replace_once(preview_previous if source.count(preview_previous) == 1 else preview_original, preview_final)

# In the recovered UI the reply tooltip was overwritten with "Forward". Keep
# both actions as separate buttons so Forward never selects reply mode.
upgrade_once(
    'n.onReplyMouseEnter=function(e){n.props.onShouldShowTooltip(e.target,"forward")}',
    'n.onForwardMouseEnter=function(e){n.props.onShouldShowTooltip(e.target,"forward")}',
)
upgrade_once(
    'className:"im_dialog_message_button -reply",onClick:this.onReplyClick})),0==this.props.groupId',
    'className:"im_dialog_message_button -reply",onClick:this.onReplyClick})),t.push(d.default.createElement("div",{key:"fwd",onMouseEnter:this.onForwardMouseEnter,onMouseLeave:this.props.onShouldHideTooltip,className:"im_dialog_message_button -forward",onClick:this.onForwardClick})),0==this.props.groupId',
)

# Keep the reply fields when a local outgoing message is replaced by a short
# long-poll payload, and let the existing forwarded-message component render
# the replied-to message with its normal avatar, name and timestamp.
upgrade_once(
    'this.replyTo=t.reply_to||null,this.replyMessage=t.reply_message||null,this.peerId=t.peer_id',
    'this.replyTo=t.reply_to||this.draftReplyTo||this.replyTo||null,this.replyMessage=t.reply_message||this.replyMessage||null,this.peerId=t.peer_id',
)
upgrade_once(
    'this.replyTo=t.reply_to||null,this.replyMessage=t.reply_message||null,this.out=t.out||!1',
    'this.replyTo=t.reply_to||this.replyTo||null,this.replyMessage=t.reply_message||this.replyMessage||null,this.out=t.out||!1',
)
upgrade_many(
    'this.fwdMessages=t.fwd_messages.map(function(e){return l.default.FromRawMessage(e,t.id)})),t.emoji',
    'this.fwdMessages=t.fwd_messages.map(function(e){return l.default.FromRawMessage(e,t.id)})),window.OpenVKCompat.applyReply(this,t,l.default),t.emoji',
    2,
)
upgrade_once(
    '_.replyMessage=u.messages[n.draftReplyTo]||null),r&&i',
    '_.replyMessage=u.messages[n.draftReplyTo]||null,window.OpenVKCompat.applyReply(_,null)),r&&i',
)
upgrade_once(
    '):[window.OpenVKCompat.renderReply(c.default,t),c.default.createElement(v.default,{key:"mt"',
    '):[c.default.createElement(v.default,{key:"mt"',
)
upgrade_once(
    'availableContentWidth:A}),c.default.createElement(g.default,{key:"fw"',
    'availableContentWidth:A}),window.OpenVKCompat.renderReply(c.default,t),c.default.createElement(g.default,{key:"fw"',
)
upgrade_once(
    'window.OpenVKCompat.renderReply(c.default,t),c.default.createElement(h.default,{key:"at"',
    'window.OpenVKCompat.renderReply(c.default,t,!0),c.default.createElement(h.default,{key:"at"',
)

# Long poll can deliver the sent message before messages.send confirms its ID.
# In that case the store already has a server message when it removes the
# optimistic one. Carry the reply card into either replacement order.
upgrade_once(
    'var u=a.messageIds.includes(r);u||(a.messages[r]=s);',
    'var u=a.messageIds.includes(r);u?window.OpenVKCompat.inheritReply(a.messages[r],s):a.messages[r]=s;',
)
upgrade_once(
    'var d=s.getMessageById(r.id);return(d.fwdLoading||d.attachments.length!=r.attachments.length||d.time!=r.time||d.text!=r.text)&&',
    'var d=s.getMessageById(r.id);return window.OpenVKCompat.inheritReply(r,d),(d.fwdLoading||d.attachments.length!=r.attachments.length||d.time!=r.time||d.text!=r.text||d.replyTo!=r.replyTo)&&',
)
upgrade_once(
    'l.messages[m.id]=m,l.messageIds.push(m.id)',
    'l.messages[m.id]=window.OpenVKCompat.inheritReply(m,l.messages[m.id]),l.messageIds.push(m.id)',
)
upgrade_once(
    'l.messages[_.id]=_,l.messageIds.unshift(_.id)',
    'l.messages[_.id]=window.OpenVKCompat.inheritReply(_,l.messages[_.id]),l.messageIds.unshift(_.id)',
)

bundle.write_text(source, encoding="utf-8")
print("Patched desktop reply support:", bundle)
