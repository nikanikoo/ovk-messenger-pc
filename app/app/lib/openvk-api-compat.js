(function (root) {
  "use strict";

  function resolveMediaUrl(value) {
    if (typeof value !== "string" || !value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    var instance = root.OpenVKInstance;
    if (value.slice(0, 2) === "//") return (instance ? instance.getScheme() : "https:") + value;
    if (value.charAt(0) === "/" && instance && instance.isValid()) return instance.getOrigin() + value;
    return value;
  }

  function wrapApi(api) {
    function normalizeStickerUrls(value) {
      if (typeof value === "string") {
        return resolveMediaUrl(value);
      }
      if (Array.isArray(value)) return value.map(normalizeStickerUrls);
      if (value && typeof value === "object") {
        Object.keys(value).forEach(function (key) { value[key] = normalizeStickerUrls(value[key]); });
      }
      return value;
    }

    function request(method, params, options) {
      var pending = [];
      var cancelled = false;
      params = params || {};
      options = options || {};

      function call(name, body) {
        if (cancelled) return Promise.reject(new Error("Request cancelled"));
        var child = api(name, body || {}, Object.assign({}, options, { returnRequest: true }));
        pending.push(child);
        return child.promise;
      }

      function finish(promise) {
        if (!options.returnRequest) return promise;
        return {
          promise: promise,
          abortSilently: function () {
            cancelled = true;
            pending.forEach(function (child) { child.abortSilently(); });
          },
          abort: function () {
            cancelled = true;
            pending.forEach(function (child) { child.abort(); });
          }
        };
      }

      function groupBanned() {
        var body = { group_id: params.group_id, offset: params.offset || 0, count: params.count || 200 };
        if (!params.user_id) {
          return call("groups.getBanned", body).then(function (data) {
            data.items = (data.items || []).map(function (user) {
              return { type: "profile", profile: user, ban_info: {
                date: 0, end_date: 0, admin_id: 0, reason: 0, comment: "", comment_visible: false
              } };
            });
            return data;
          });
        }
        var wanted = Number(params.user_id);
        function page(offset) {
          return call("groups.getBanned", { group_id: params.group_id, offset: offset, count: 200 }).then(function (data) {
            var items = data.items || [];
            var found = items.filter(function (user) { return Number(user.id) === wanted; });
            if (found.length || !items.length || offset + items.length >= Number(data.count || 0)) {
              return { count: found.length, items: found };
            }
            return page(offset + items.length);
          });
        }
        return page(0);
      }

      function groupCounters() {
        var counters = { unread_dialogs: 0, important_dialogs: 0, unanswered_dialogs: 0 };
        function page(offset) {
          return call("messages.getConversations", {
            group_id: Number(params.group_ids), offset: offset, count: 200, filter: "all"
          }).then(function (data) {
            var items = data.items || [];
            if (offset === 0) counters.unread_dialogs = Number(data.unread_count) || 0;
            items.forEach(function (item) {
              var conversation = item.conversation || item;
              if (conversation.important) counters.important_dialogs++;
              if (conversation.unanswered) counters.unanswered_dialogs++;
            });
            if (items.length && offset + items.length < Number(data.count || 0)) {
              return page(offset + items.length);
            }
            return [counters];
          });
        }
        return page(0);
      }

      function hydrateReplies(history) {
      if (!history || !Array.isArray(history.items)) return Promise.resolve(history);
      history.items.forEach(function (item) { normalizeMessageAuthor(item); normalizeMessage(item); });
      var missing = {};
      history.items.forEach(function (item) {
        if (item && !item.reply_to && item.reply_message) {
          item.reply_to = item.reply_message.id || item.reply_message.origId || null;
        }
        if (item && item.reply_to && !item.reply_message) missing[item.reply_to] = true;
      });
      var ids = Object.keys(missing);
      if (!ids.length) return Promise.resolve(history);
      return call("messages.getById", groupParams({
        message_ids: ids.join(","), extended: 1,
        fields: "photo_50,photo_100,photo_200,online"
      })).then(function (data) {
        var replies = {};
        (data.items || []).forEach(function (item) { normalizeMessage(item); replies[item.id] = item; });
        history.items.forEach(function (item) {
          if (item && item.reply_to && !item.reply_message && replies[item.reply_to]) {
            item.reply_message = replies[item.reply_to];
          }
        });
        ["profiles", "groups"].forEach(function (key) {
          var known = {};
          history[key] = history[key] || [];
          history[key].forEach(function (entity) { known[entity.id] = true; });
          (data[key] || []).forEach(function (entity) {
            if (!known[entity.id]) history[key].push(entity);
          });
        });
        return history;
      }).catch(function () { return history; });
      }

      function normalizeHistory(history) {
        if (!history) return history;
        if (!Array.isArray(history.conversations) || !history.conversations.length) {
          history.conversations = [{ in_read: 0, out_read: 0, last_message_id: 0 }];
        }
        return history;
      }

      function normalizeMessageAuthor(message) {
        if (!message || message.admin_author_id) return;
        var author = Number(message.admin_id || message.signer_id || message.author_id);
        if (author > 0) message.admin_author_id = author;
      }

      function normalizeConversations(data) {
        if (!data) return data;
        function normalize(conversation) {
          normalizeMessage(conversation && conversation.last_message);
          if (!conversation || !conversation.peer || conversation.peer.type !== "community") return;
          // OpenVK IM describes the channel; Messenger expects the peer kind.
          conversation.peer.type = Number(conversation.peer.id) < 0 ? "group" : "user";
        }
        (data.items || []).forEach(function (item) {
          normalize(item.conversation || item);
          normalizeMessageAuthor(item.last_message);
          normalizeMessage(item.last_message);
        });
        (data.conversations || []).forEach(normalize);
        return data;
      }

      function localTemplates(action) {
        var origin = root.OpenVKInstance && root.OpenVKInstance.getOrigin() || "default";
        var key = "openvk.templates." + origin + "." + String(params.group_id || 0);
        var items;
        try { items = JSON.parse(root.localStorage.getItem(key) || "[]"); } catch (_) { items = []; }
        if (!Array.isArray(items)) items = [];
        if (action === "get") return { count: items.length, items: items };
        if (action === "add") {
          var id = Date.now();
          while (items.some(function (item) { return Number(item.id) === id; })) id++;
          items.push({ id: id, name: params.name, text: params.text });
          root.localStorage.setItem(key, JSON.stringify(items));
          return id;
        }
        if (action === "edit") {
          items.forEach(function (item) {
            if (String(item.id) === String(params.template_id)) {
              item.name = params.name;
              item.text = params.text;
            }
          });
        } else if (action === "delete") {
          items = items.filter(function (item) { return String(item.id) !== String(params.template_id); });
        }
        root.localStorage.setItem(key, JSON.stringify(items));
        return 1;
      }

      if (method.indexOf("openvk.") !== 0) {
        if (/^messages\.(get|add|edit|delete)Template(s)?$/.test(method)) {
          return finish(Promise.resolve().then(function () {
            return localTemplates(method.slice(9).replace(/Templates?$/, "").toLowerCase());
          }));
        }
        if (method === "groups.get" && params.filter === "editor") {
          return finish(call("groups.get", Object.assign({}, params, { filter: "admin" })).then(function (data) {
            (data.items || []).forEach(function (group) {
              if (group.deactivated == null) delete group.deactivated;
            });
            return data;
          }));
        }
        if (method === "account.banUser" || method === "account.unbanUser") {
          return finish(call(method === "account.banUser" ? "account.ban" : "account.unban", {
            owner_id: params.user_id
          }));
        }
        if (method === "groups.banUser") {
          return finish(call("groups.ban", {
            group_id: params.group_id, owner_id: params.user_id, reason: params.reason,
            end_date: params.end_date, comment: params.comment, comment_visible: params.comment_visible
          }));
        }
        if (method === "groups.unbanUser") {
          return finish(call("groups.unban", { group_id: params.group_id, owner_id: params.user_id }));
        }
        if (method === "groups.getBanned") return finish(groupBanned());
        if (method === "messages.getGroupsCounters") return finish(groupCounters());
        if (method === "messages.getConversations" || method === "messages.getConversationsById") {
          return finish(call(method, params).then(normalizeConversations));
        }
        if (method === "messages.getLongPollHistory" && params.group_id) {
          return finish(call(method, params).then(function (data) {
            if (Array.isArray(data.conversations)) return normalizeConversations(data);
            var peers = {};
            ((data.messages && data.messages.items) || []).forEach(function (item) {
              if (item && item.peer_id) peers[item.peer_id] = true;
            });
            var ids = Object.keys(peers);
            data.conversations = [];
            if (!ids.length) return data;
            return call("messages.getConversationsById", {
              group_id: params.group_id, peer_ids: ids.join(","), extended: 1
            }).then(function (conversations) {
              normalizeConversations(conversations);
              data.conversations = conversations.items || [];
              return data;
            });
          }));
        }
        if (method !== "messages.getById" && method !== "messages.getHistory" && method !== "messages.getByConversationMessageId") return api(method, params, options);
        return finish(call(method, params).then(function (data) {
          return hydrateReplies(method === "messages.getHistory" ? normalizeHistory(data) : data);
        }));
      }

      function groupParams(body) {
        if (params.group_id) body.group_id = params.group_id;
        return body;
      }

      function conversation(peerId) {
        return call("messages.getConversationsById", groupParams({ peer_ids: peerId, extended: 1 })).then(function (data) {
          normalizeConversations(data);
          return data.items && data.items[0] || null;
        });
      }

      function members(peerId) {
        return call("messages.getConversationMembers", groupParams({ peer_id: peerId, extended: 1 }));
      }

      function stickers() {
        return Promise.all([
          call("stickers.get", { count: 1000 }),
          call("store.getStickersKeywords", { aliases: 1, all_products: 1, need_stickers: 1 })
            .catch(function () { return { dictionary: [] }; })
        ]).then(function (values) {
          var packs = values[0];
          packs.items = (packs.items || []).map(function (pack) {
            pack.active = 1;
            pack.stickers = (pack.stickers || []).map(function (sticker) {
              sticker.product_id = pack.id;
              sticker.images = sticker.images || [];
              sticker.images_with_background = sticker.images_with_background || sticker.images;
              return sticker;
            });
            return pack;
          });
          return { stickers: normalizeStickerUrls(packs), keywords: normalizeStickerUrls(values[1]) };
        });
      }

      function account() {
        return call("account.getProfileInfo").then(function (profile) {
          // accountInfoHandler selects mail_send, then Settings reads value.category.
          if (!Array.isArray(profile.privacy)) profile.privacy = [];
          if (!profile.privacy.some(function (item) { return item.key === "mail_send"; })) {
            profile.privacy.push({ key: "mail_send", value: { category: "all" } });
          }
          return profile;
        });
      }

      var result;
      switch (method.slice(7)) {
        case "getAccountInfo":
          result = account();
          break;
        case "getChat":
          result = Promise.all([conversation(params.peer_id), members(params.peer_id)]).then(function (values) {
            return { conversation: values[0], members: values[1] };
          });
          break;
        case "getConversationUnread":
          result = conversation(params.peer_id).then(function (value) { return value ? value.unread_count || 0 : 0; });
          break;
        case "getConversationReadState":
          result = conversation(params.peer_id).then(function (value) {
            return value ? {
              in_read: value.in_read || 0,
              out_read: value.out_read || 0,
              unread_count: value.unread_count || 0
            } : { in_read: 0, out_read: 0, unread_count: 0 };
          });
          break;
        case "getConversationWithMessage":
          result = Promise.all([
            conversation(params.peer_id),
            call("messages.getHistory", groupParams({ peer_id: params.peer_id, count: 1 }))
          ]).then(function (values) {
            return { conversation: values[0], last_message: values[1].items && values[1].items[0] || null };
          });
          break;
        case "getDialogsAndLP":
          result = Promise.all([
            call("messages.getConversations", groupParams({
              offset: params.offset || 0, count: params.count || 20,
              filter: params.important ? "important" : params.filter || "all",
              extended: 1, fields: "photo_50,photo_100,photo_200,online,last_seen"
            })).then(normalizeConversations),
            params.lp ? call("messages.getLongPollServer", groupParams({ need_pts: 1, lp_version: 2, use_ssl: 1 })).catch(function (error) {
              // Bootstrap can display dialogs while its own long poll startup retries.
              console.warn("OpenVK long poll bootstrap failed; retrying after dialogs load", error.code || error);
              return null;
            }) : Promise.resolve(null),
            call("messages.get", groupParams({ filters: 8, count: 1 })).catch(function () { return { count: 0 }; })
          ]).then(function (values) {
            return {
              conversations: values[0], lp: values[1], importantMessagesCount: values[2].count || 0,
              groupCounters: null
            };
          });
          break;
        case "getHistoryWithChatD":
          result = Promise.all([
            call("messages.getHistory", groupParams({
              peer_id: params.peer_id, count: params.count, offset: params.offset || 0,
              start_message_id: params.start_message_id || 0, rev: params.rev || 0,
              preview_length: params.preview_length || 0, extended: 1, fields: params.fields
            })),
            conversation(params.peer_id), members(params.peer_id)
          ]).then(function (values) {
            var history = values[0];
            if (!history.conversations || !history.conversations.length) {
              history.conversations = [values[1] || { in_read: 0, out_read: 0, last_message_id: 0 }];
            }
            return hydrateReplies(history).then(function () {
              return { history: history, conversation: values[1], members: values[2], unread: history.unread_count || 0 };
            });
          });
          break;
        case "getProfilesA":
          result = Promise.all([
            params.user_ids ? call("users.get", { user_ids: params.user_ids, fields: params.fields }) : Promise.resolve([]),
            params.group_ids ? call("groups.getById", { group_ids: params.group_ids, fields: params.fields }) : Promise.resolve([])
          ]).then(function (values) { return { users: values[0], groups: values[1] }; });
          break;
        case "getStickers":
          result = stickers();
          break;
        case "initialA":
          result = Promise.all([
            call("users.get", { user_ids: params.user_id, fields: params.fields }),
            call("friends.get", { user_id: params.user_id, fields: params.fields_friends, count: 5000 })
          ]).then(function (values) {
            return { profile: values[0][0], friends1: values[1], friends2: { items: [] },
              push_settings: { conversations: { items: [] } } };
          });
          break;
        case "markAsImportant":
          result = call("messages.markAsImportant", { message_ids: params.message_ids, important: params.important }).then(function () {
            return call("messages.get", { filters: 8, count: 1 });
          }).then(function (data) { return { count: data.count || 0 }; });
          break;
        case "getBootstrapData":
          result = Promise.all([call("utils.getServerTime"), account(), stickers()]).then(function (values) {
            return { time: values[0], account: values[1], stickers: values[2].stickers, keywords: values[2].keywords };
          });
          break;
        default:
          throw new Error("Unknown OpenVK operation: " + method);
      }

      if (!options.returnRequest) return result;
      return {
        promise: result,
        abortSilently: function () {
          cancelled = true;
          pending.forEach(function (child) { child.abortSilently(); });
        },
        abort: function () {
          cancelled = true;
          pending.forEach(function (child) { child.abort(); });
        }
      };
    }

    return request;
  }

  function normalizeLongPoll(updates) {
    if (!Array.isArray(updates)) return updates;
    updates.forEach(function (update) {
      // OpenVK LP v2 sends [4, id, flags, peer, time, title, text, attachments].
      // This messenger reads [4, id, flags, peer, time, text, attachments].
      if (Array.isArray(update) && update[0] === 4 && typeof update[6] === "string" &&
          update[7] && typeof update[7] === "object" && !Array.isArray(update[7])) {
        update.splice(5, 1);
      }
    });
    return updates;
  }

  function normalizeVideo(video) {
    if (!video) return video;
    var images = Array.isArray(video.image) ? video.image : [];
    function closest(width) {
      var best = null;
      images.forEach(function (image) {
        if (!image || !image.url) return;
        if (!best || Math.abs(Number(image.width) - width) < Math.abs(Number(best.width) - width)) best = image;
      });
      return best ? resolveMediaUrl(best.url) : "";
    }
    var fallback = resolveMediaUrl(video.image_medium || (typeof video.image === "string" ? video.image : ""));
    video.photo_130 = resolveMediaUrl(video.photo_130) || closest(130) || fallback;
    video.photo_320 = resolveMediaUrl(video.photo_320) || closest(320) || video.photo_130 || fallback;
    video.photo_640 = resolveMediaUrl(video.photo_640) || video.photo_320;
    video.photo_800 = resolveMediaUrl(video.photo_800) || video.photo_640;
    return video;
  }

  function normalizePhoto(photo) {
    if (!photo || typeof photo !== "object") return;
    var sizes = Array.isArray(photo.sizes) ? photo.sizes :
      photo.sizes && typeof photo.sizes === "object" ? Object.keys(photo.sizes).map(function (key) {
        var size = photo.sizes[key];
        if (size && !size.type) size.type = key;
        return size;
      }) : [];
    sizes = sizes.filter(function (size) {
      if (!size) return false;
      size.url = resolveMediaUrl(size.url || size.src);
      if (!size.url) return false;
      size.width = Number(size.width) || Number(photo.width) || 604;
      size.height = Number(size.height) || Number(photo.height) || 604;
      return true;
    });
    if (!sizes.length) {
      var width = Number(photo.width || (photo.orig_photo && photo.orig_photo.width)) || 0;
      var height = Number(photo.height || (photo.orig_photo && photo.orig_photo.height)) || 0;
      [
        ["s", photo.photo_75 || photo.src_small, 75],
        ["m", photo.photo_130 || photo.src, 130],
        ["x", photo.photo_604 || photo.src_big, 604],
        ["y", photo.photo_807 || photo.src_xbig, 807],
        ["z", photo.photo_1280 || photo.src_xxbig, 1280],
        ["w", photo.photo_2560 || photo.src_xxxbig || photo.src_original || photo.url || (photo.orig_photo && photo.orig_photo.url), 2560]
      ].forEach(function (entry) {
        if (typeof entry[1] !== "string" || !entry[1]) return;
        var scale = width && height ? Math.min(1, entry[2] / Math.max(width, height)) : 1;
        sizes.push({
          type: entry[0],
          url: resolveMediaUrl(entry[1]),
          width: width ? Math.max(1, Math.round(width * scale)) : entry[2],
          height: height ? Math.max(1, Math.round(height * scale)) : entry[2]
        });
      });
    }
    if (sizes.length) photo.sizes = sizes;
  }

  function normalizeMessage(message) {
    if (!message || typeof message !== "object") return;
    if (Array.isArray(message.attachments)) message.attachments.forEach(function (attachment) {
      if (attachment && attachment.type === "photo") normalizePhoto(attachment.photo);
    });
    if (Array.isArray(message.fwd_messages)) message.fwd_messages.forEach(normalizeMessage);
    normalizeMessage(message.reply_message);
  }

  function inheritContent(target, source) {
    if (!target || !source) return target;
    if ((!target.attachments || !target.attachments.length) && source.attachments && source.attachments.length) {
      target.attachments = source.attachments;
    }
    if (!target.text && source.text) target.text = source.text;
    return target;
  }

  function applyReply(message, raw, ForwardMessage) {
    if (!message || !message.replyMessage) return;
    if (!message.replyTo) {
      message.replyTo = message.replyMessage.id || message.replyMessage.origId || null;
    }
    if (!message.replyTo) return;
    var reply = message.replyMessage;
    var forwarded;
    if (typeof reply.toFwdMessageObject === "function") {
      forwarded = reply.toFwdMessageObject();
    } else if (ForwardMessage && typeof ForwardMessage.FromRawMessage === "function") {
      var source = Object.assign({}, reply, { origId: reply.id || reply.origId });
      forwarded = ForwardMessage.FromRawMessage(source, message.id);
    }
    if (!forwarded) return;
    if (message._openvkReplyForwarded && message.fwdMessages) {
      message.fwdMessages = message.fwdMessages.filter(function (item) {
        return item !== message._openvkReplyForwarded;
      });
    }
    message.fwdMessages = message.fwdMessages || [];
    message.fwdMessages.unshift(forwarded);
    message._openvkReplyForwarded = forwarded;
  }

  function inheritReply(target, source) {
    if (!target || !source) return target;
    if (!target.replyTo) target.replyTo = source.replyTo || null;
    if (!target.replyMessage) target.replyMessage = source.replyMessage || null;
    if (!target.replyTo && target.replyMessage) {
      target.replyTo = target.replyMessage.id || target.replyMessage.origId || null;
    }
    if (!target.replyTo) return target;
    if (!target._openvkReplyForwarded && source._openvkReplyForwarded) {
      target.fwdMessages = target.fwdMessages || [];
      target.fwdMessages.unshift(source._openvkReplyForwarded);
      target._openvkReplyForwarded = source._openvkReplyForwarded;
    } else if (!target._openvkReplyForwarded) {
      applyReply(target, null, null);
    }
    return target;
  }

  function renderReply(React, message, alternateLayout) {
    if (!message || !message.replyTo) return null;
    var title = React.createElement("div", {
      key: "openvk-reply-title", className: "im_fwd_messages_title openvk-reply-title"
    }, "\u0412 \u043e\u0442\u0432\u0435\u0442 \u043d\u0430 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435");
    if (!alternateLayout) return title;
    var reply = message.replyMessage;
    if (!reply) return title;
    return React.createElement("div", {
      key: "openvk-reply", className: "im_fwd_messages openvk-message-reply"
    }, title, React.createElement("div", { className: "im_fwd_message" },
      React.createElement("div", { className: "im_dialog_message_text" }, reply.text || "")));
  }

  root.OpenVKCompat = { wrapApi: wrapApi, normalizeLongPoll: normalizeLongPoll, normalizeVideo: normalizeVideo, normalizePhoto: normalizePhoto, normalizeMessage: normalizeMessage, applyReply: applyReply, inheritReply: inheritReply, inheritContent: inheritContent, renderReply: renderReply };
})(window);
