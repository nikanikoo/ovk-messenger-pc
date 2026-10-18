(function (root) {
  "use strict";

  var runtime;

  function thumbnail(message) {
    var attachments = message && message.attachments || [];
    for (var i = 0; i < attachments.length; i++) {
      var attachment = attachments[i];
      var image = null;
      switch (attachment.getType()) {
        case "photo": image = attachment.getBySize("m"); break;
        case "doc": image = attachment.getImageSrc(true); break;
        case "link": image = attachment.photo && attachment.photo.getBySize("m"); break;
        case "graffiti": image = attachment.url; break;
        case "market": image = attachment.thumb_photo; break;
        case "video": image = attachment.getThumb(40 * (root.devicePixelRatio || 1)); break;
        case "story": image = attachment.photoObject && attachment.photoObject.getBySize("m"); break;
      }
      if (image) return typeof image === "string" ? image : image.url;
    }
    return null;
  }

  function render(React, message, groupId, peerId, onRemove) {
    if (!message || !message.replyTo) return null;
    var lang = root.lang;
    var reply = message.replyMessage || runtime.getMessage(groupId, peerId, message.replyTo);
    var title = lang.im_reply;
    var summary = { text: lang.message, isServiceMessage: true };
    if (reply) {
      var group = groupId && runtime.getGroup(groupId);
      var user = runtime.getUser(reply.fromId);
      title = group && reply.out ? group.name : user && user.getName() || lang.message;
      summary = runtime.getText(reply);
    }
    var image = thumbnail(reply);
    var isDraft = typeof onRemove === "function";

    function goToMessage(event) {
      event.preventDefault();
      event.stopPropagation();
      runtime.toMessage(groupId, peerId, message.replyTo);
    }

    return React.createElement("div", {
      key: "openvk-reply",
      className: "im_message_reply" + (isDraft ? " openvk-draft-reply" : ""),
      role: isDraft ? undefined : "button",
      tabIndex: isDraft ? undefined : 0,
      title: isDraft ? undefined : lang.viewer_go_to_message,
      onClick: isDraft ? undefined : goToMessage,
      onMouseDown: isDraft ? undefined : function (event) {
        // Keep mouse clicks from taking focus away from the composer.
        // Keyboard navigation still focuses the quote and shows its outline.
        event.preventDefault();
        event.stopPropagation();
      },
      onKeyDown: isDraft ? undefined : function (event) {
        if (event.key === "Enter" || event.key === " ") goToMessage(event);
      }
    }, React.createElement("div", { className: "im_message_reply_line" }),
    React.createElement("div", { className: "im_message_reply_right" },
      image && React.createElement("img", {
        className: "im_message_reply_img", width: 40, height: 40, src: image, alt: "", draggable: false
      }),
      React.createElement("div", { className: "im_message_reply_title --text-overflow" }, title),
      React.createElement("div", {
        className: "im_message_reply_text" + (summary.isServiceMessage ? " -attaches" : "")
      }, summary.isServiceMessage ? summary.text : runtime.formatText(summary.text))),
    isDraft && React.createElement("button", {
      type: "button", className: "im_input_attach_fwd_remove openvk-reply-remove",
      title: lang.im_remove_attachment, "aria-label": lang.im_remove_attachment,
      onClick: function (event) {
        event.preventDefault();
        event.stopPropagation();
        onRemove();
      }
    }));
  }

  root.OpenVKReplies = {
    configure: function (value) { runtime = value; },
    render: render,
    renderDraft: function (React, groupId, peerId, replyTo, onRemove) {
      return render(React, { replyTo: replyTo }, groupId, peerId, onRemove);
    }
  };
})(window);
