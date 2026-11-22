/**
 * Tiny local SMTP server for testing the contact form without a real mail account.
 *   npm run mail:capture
 * then in .env.local:  CONTACT_TRANSPORT=smtp SMTP_HOST=127.0.0.1 SMTP_PORT=2525 SMTP_SECURE=false
 * Every message the site sends is printed here and saved to ./.contact-outbox/captured/*.eml
 */
import fs from "node:fs";
import path from "node:path";
import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";

const dir = path.resolve(".contact-outbox", "captured");
fs.mkdirSync(dir, { recursive: true });
const port = Number(process.env.SMTP_CAPTURE_PORT ?? 2525);

const server = new SMTPServer({
  authOptional: true,
  allowInsecureAuth: true,
  disabledCommands: ["STARTTLS"],
  onData(stream, session, cb) {
    const chunks = [];
    stream.on("data", (c) => chunks.push(c));
    stream.on("end", async () => {
      const raw = Buffer.concat(chunks);
      const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}.eml`);
      fs.writeFileSync(file, raw);
      const mail = await simpleParser(raw);
      console.log("\n==== EMAIL RECEIVED ====");
      console.log("From:     ", mail.from?.text);
      console.log("To:       ", mail.to?.text);
      console.log("Reply-To: ", mail.replyTo?.text);
      console.log("Subject:  ", mail.subject);
      console.log("\n" + mail.text);
      console.log("========================\n(saved to " + path.relative(process.cwd(), file) + ")");
      cb();
    });
  },
});
server.listen(port, "127.0.0.1", () => console.log(`SMTP capture listening on 127.0.0.1:${port}  (Ctrl+C to stop)`));
