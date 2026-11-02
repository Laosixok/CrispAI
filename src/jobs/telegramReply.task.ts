import * as db from "@/services/db.service";
import * as storage from "@/services/storage.service";
import * as telegram from "@/services/telegram.service";
import * as crisp from "@/services/crisp.service";
import { Queue } from "bullmq";
import type { Message } from "grammy/types";
import path from "path";
import { createResponse } from "@/utils/general";
import axios from "axios";
import { connection } from "@/services/redis.service";
import { selectMedia, MAX_MEDIA_BYTES } from "@/utils/telegramMedia";

const name = path.basename(import.meta.url, path.extname(import.meta.url));
export default {
  name,
  queue: new Queue(name, {
    connection,
    defaultJobOptions: {
      removeOnComplete: { count: 1000, age: 7 * 24 * 3600 },
      removeOnFail: { count: 1000 },
      // No blind retries: an ambiguous Crisp timeout may already have delivered.
      attempts: 1,
    },
  }),
  concurrency: 10,
  processor: async (job: any) => {
    const message = job.data as Message;
    const groupId = message.chat.id;
    const topicId = message.message_thread_id;
    if (!topicId) return createResponse(false, "非话题消息");
    const session = await db.getSessionByTopic(groupId, topicId);
    if (!session) return createResponse(false, "会话不存在");
    const project = await db.getProject(session.website_id);
    if (!project) return createResponse(false, "未找到项目");
    const sessionId = "session_" + session.session_id;
    try {
      // Take over before downloads and API calls, including failed sends.
      await db.setSessionReplyByTopic(groupId, topicId, false);
      await telegram.default.api.editMessageReplyMarkup(groupId, session.message_id, {
        reply_markup: telegram.changeAI(groupId, topicId, false),
      }).catch(() => {});
      const media = selectMedia(message);
      // Prepare the attachment before sending the caption to avoid partial delivery on download errors.
      const attachment = media ? await uploadFile(media) : undefined;
      await crisp.composeMessage(session.website_id, sessionId, true);
      const text = ("text" in message && message.text) || ("caption" in message && message.caption);
      if (text) await crisp.sendMessage(project.websiteId, sessionId, text, project.botName, project.botIcon);
      if (attachment) await crisp.sendFile(project.websiteId, sessionId, attachment, project.botName, project.botIcon);
      await telegram.default.api.setMessageReaction(groupId, message.message_id, [
        { type: "emoji", emoji: "👌" },
      ]).catch(() => {});
      return createResponse(true, "任务执行成功");
    } catch {
      // Never expose Axios errors: Telegram download URLs contain the bot token.
      await telegram.default.api.sendMessage(groupId,
        "发送至 Crisp 失败，可能有部分内容已送达。请核实后重发；AI 已暂停。附件须不超过 20 MB。",
        { message_thread_id: topicId, reply_parameters: { message_id: message.message_id } },
      ).catch(() => {});
      throw new Error(`Telegram reply failed (${groupId}/${message.message_id})`);
    } finally {
      await crisp.composeMessage(session.website_id, sessionId, false);
    }
  },
};

async function uploadFile(media: NonNullable<ReturnType<typeof selectMedia>>) {
  const publicUrl = new URL(Bun.env.PUBLIC_URL ?? "");
  if (publicUrl.protocol !== "https:") throw new Error("PUBLIC_URL must use HTTPS");
  if (media.size && media.size > MAX_MEDIA_BYTES) throw new Error("Attachment too large");
  const file = await telegram.default.api.getFile(media.id);
  if (!file.file_path || (file.file_size && file.file_size > MAX_MEDIA_BYTES)) throw new Error("Invalid attachment");
  const response = await axios.get<ArrayBuffer>(
    `https://api.telegram.org/file/bot${Bun.env.TELEGRAM_TOKEN}/${file.file_path}`,
    { responseType: "arraybuffer", timeout: 30000, maxContentLength: MAX_MEDIA_BYTES,
      maxBodyLength: MAX_MEDIA_BYTES, maxRedirects: 0 },
  );
  const ext = path.extname(media.name || file.file_path) || ".bin";
  const url = await storage.saveFile(crypto.randomUUID() + ext, new Uint8Array(response.data));
  return { url, name: path.basename(media.name || file.file_path), type: media.type };
}
