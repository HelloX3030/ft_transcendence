import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

/**
 * Sends the few transactional mails the app produces. In development this points
 * at Mailpit, which captures mail at http://localhost:8025 rather than delivering
 * it; switching to a real provider is three environment values. Bodies are plain
 * text on purpose: an HTML template would need a templating engine and a second
 * rendering path for mail that is three sentences long.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  /**
   * Built lazily so a missing or unreachable SMTP host cannot stop the app from
   * booting, mail is not on the critical path for anything but this feature.
   */
  private getTransporter(): Transporter {
    this.transporter ??= createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      // Mailpit speaks plain SMTP on the internal network and offers no TLS.
      // The connection never leaves Docker; a real provider would set both.
      secure: false,
      ignoreTLS: true,
    });
    return this.transporter;
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    await this.getTransporter().sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject,
      text,
    });
  }

  /**
   * Never awaited by a request handler. The forgot-password endpoint answers
   * identically for known and unknown addresses, and awaiting the send would
   * leak which one it was through the response latency.
   */
  sendInBackground(to: string, subject: string, text: string): void {
    this.send(to, subject, text).catch((error: Error) => {
      // Logged, never surfaced: the caller has already answered, and the
      // response must not depend on whether delivery worked.
      this.logger.error(`Failed to send "${subject}"`, error);
    });
  }
}
